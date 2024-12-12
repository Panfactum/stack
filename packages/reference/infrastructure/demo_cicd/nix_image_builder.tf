locals {
  nix_image_builder_name = "nix-image-builder"
}

#############################################################
# Nix Store PVCs
#
# We save the nix store in a PVC so that we can re-use
# it across runs. We maintain a nix store both for x86 and arm
# builders.
#############################################################

resource "kubectl_manifest" "pvc" {
  for_each = toset(["amd64", "arm64"])
  yaml_body = yamlencode({
    apiVersion = "v1"
    kind = "PersistentVolumeClaim"
    metadata = {
      name = "nix-store-${each.key}"
      namespace = local.namespace
      annotations = {
        "resize.topolvm.io/inodes-threshold" = "20%"
        "resize.topolvm.io/threshold" = "20%"
        "resize.topolvm.io/increase" = "10Gi"
        "resize.topolvm.io/storage_limit" = "100Gi"
      }
    }
    spec = {
      resources = {
        requests = {
          storage = "20Gi"
        }
      }
      accessModes = ["ReadWriteOnce"]
      storageClassName = "ebs-standard"
    }
  })
  server_side_apply = true
  force_conflicts   = true

  ignore_fields = ["spec.resources"]
}

#############################################################
# AWS Permissions
#
# This policy gives the Workflow the ability to upload
# and download images from the repository
#############################################################

data "aws_iam_policy_document" "nix_builder_ecr" {
  statement {
    sid = "PrivateECR"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:ListImages",
      "ecr:PutImage",
      "ecr:UploadLayerPart"
    ]
    resources = [
      "arn:aws:ecr:us-east-2:891377197483:repository/panfactum"
    ]
  }
  statement {
    sid = "PrivateECRAuth"
    effect = "Allow"
    actions = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "PublicECR"
    effect = "Allow"
    actions = [
      "ecr-public:BatchCheckLayerAvailability",
      "ecr-public:BatchGetImage",
      "ecr-public:CompleteLayerUpload",
      "ecr-public:DescribeImages",
      "ecr-public:DescribeRepositories",
      "ecr-public:GetDownloadUrlForLayer",
      "ecr-public:InitiateLayerUpload",
      "ecr-public:ListImages",
      "ecr-public:PutImage",
      "ecr-public:UploadLayerPart"
    ]
    resources = [
      "arn:aws:ecr-public::891377197483:repository/panfactum"
    ]
  }
  statement {
    sid = "PublicECRAuth"
    effect = "Allow"
    actions = [
      "ecr-public:GetAuthorizationToken",
      "sts:GetServiceBearerToken"
    ]
    resources = ["*"]
  }
}

#############################################################
# Workflow
#
# A few important notes:
#
# - We have two builders that run concurrently (arm and x86)
#   that mostly implement the same logic, just on different
#   host architectures
#
# - Each builder has a pre-step that initializes the store.
#   This is because we replace the /nix directory in the 'nixos/nix'
#   images with our cached /nix PVC to improve build times.
#   However, the PVC has to be setup when it is first created
#   or the builder will fail as the /nix directory will be empty.
#
# - Building nix in containers is a PITA and the only way that it
#   could work is by lifting many of the security guards. As a result,
#   this should NOT be taken as an example of how to run workflows
#   in production environments, only for build / development environments.
#
# - After the builds are done, we generate a multi-arch image manifest
#   so that the image can be run on either x86 or arm nodes
#   using the same image tag.
#############################################################

# These define our workflow scripts
resource "kubernetes_config_map" "nix_image_builder_scripts" {
  metadata {
    name = "${local.nix_image_builder_name}-scripts"
    labels = module.nix_image_builder_workflow.labels
    namespace = local.namespace
  }
  data = {
    "build-and-push.sh" = file("${path.module}/nix_image_builder/build-and-push.sh")
    "init-store.sh" = file("${path.module}/nix_image_builder/init-store.sh")
    "merge-and-copy.sh" = file("${path.module}/nix_image_builder/merge-and-copy.sh")
  }
}

# This is required for some reason by the pkgs.dockerTools
# nix derivation to work
resource "kubernetes_config_map" "nix_image_builder_containers" {
  metadata {
    name = "${local.nix_image_builder_name}-containers"
    labels = module.nix_image_builder_workflow.labels
    namespace = local.namespace
  }
  data = {
    "policy.json" = file("${path.module}/nix_image_builder/policy.json")
  }
}

module "nix_image_builder_workflow" {
  source                    = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name = local.nix_image_builder_name
  namespace = local.namespace
  burstable_nodes_enabled = true
  active_deadline_seconds = 60 * 60
  retry_backoff_max_duration_seconds = 60 * 5
  retry_max_attempts = 3

  # These are generally not advised to use
  # for security reasons but are required by nix to build
  # the flake
  run_as_root = true
  read_only = false
  privileged = true

  entrypoint = "build-image"
  arguments = {
    parameters = [
      {
        name = "git_ref"
        description = "Which commit to check out and build in the panfactum/stack repository"
        default = "main"
      }
    ]
  }
  common_env = {
    GIT_REF = "{{workflow.parameters.git_ref}}"
    IMAGE_REPO = "panfactum"
    PUBLIC_IMAGE_REGISTRY = "public.ecr.aws/t8f0s7h5"
    IMAGE_REGISTRY = "891377197483.dkr.ecr.us-east-2.amazonaws.com"
    IMAGE_REGION = "us-east-2"
  }
  extra_aws_permissions = data.aws_iam_policy_document.nix_builder_ecr.json
  templates = [
    {
      name = "build-image",
      dag = {
        tasks = [
          {
            name = "build-and-push"
            template = "build-and-push"
            arguments = {
              parameters = [{
                name = "arch"
                value = "amd64"
              }]
            }
          },
          {
            name = "build-and-push-arm"
            template = "build-and-push"
            arguments = {
              parameters = [{
                name = "arch"
                value = "arm64"
              }]
            }
          },
          {
            name = "merge-and-copy"
            template = "merge-and-copy"
            arguments = {
              parameters = [{
                name = "commit-sha"
                value = "{{tasks.build-and-push.outputs.parameters.commit-sha}}"
              }]
            }
            dependencies = [
              "build-and-push",
              "build-and-push-arm"
            ]
          }
        ]
      }
    },
    {
      name = "build-and-push"
      inputs = {
        parameters = [
          {
            name = "arch"
            enum = ["arm64", "amd64"]
          }
        ]
      }
      affinity = {
        nodeAffinity = {
          requiredDuringSchedulingIgnoredDuringExecution = {
            nodeSelectorTerms = [{
              matchExpressions = [{
                key = "kubernetes.io/arch"
                operator = "In"
                values = ["{{inputs.parameters.arch}}"]
              }]
            }]
          }
        }
      }
      tolerations = concat(
        module.nix_image_builder_workflow.tolerations,
        [{
          key      = "{{inputs.parameters.arch}}"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        }]
      )
      volumes = concat(
        module.nix_image_builder_workflow.volumes,
        [{
          name = "nix-store"
          persistentVolumeClaim ={
            claimName = "nix-store-{{inputs.parameters.arch}}"
          }
        }]
      )
      outputs = {
        parameters = [
          {
            name = "commit-sha"
            valueFrom = {
              path = "/tmp/commit-sha"
            }
          }
        ]
      }
      containerSet = {
        containers = [
          {
            name = "init-store"
            image = "${module.pull_through.docker_hub_registry}/nixos/nix"
            command = [
              "/scripts/init-store.sh"
            ]
            volumeMounts = concat(
              module.nix_image_builder_workflow.volume_mounts,
              [{
                name = "nix-store"
                mountPath = "/nix2"
              }]
            )
            resources = {
              requests = {
                memory = "250Mi"
                cpu = "100m"
              }
              limits = {
                memory = "400Mi"
              }
            }
          },
          {
            name = "main"
            image = "${module.pull_through.docker_hub_registry}/nixos/nix"
            command = [
              "/scripts/build-and-push.sh"
            ]
            env = concat(
              module.nix_image_builder_workflow.env,
              [
                {name = "ARCH", value = "{{inputs.parameters.arch}}"}
              ]
            )
            volumeMounts = concat(
              module.nix_image_builder_workflow.volume_mounts,
              [{
                name = "nix-store"
                mountPath = "/nix"
              }]
            )
            resources = {
              requests = {
                memory = "2Gi"
                cpu = "1000m"
              }
              limits = {
                memory = "2Gi"
              }
            }
            dependencies = ["init-store"]
          }
        ]
      }
    },
    {
      name = "merge-and-copy"
      tolerations = concat(
        module.nix_image_builder_workflow.tolerations,
        [{
          key      = "arm64"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        }]
      )
      volumes = concat(
        module.nix_image_builder_workflow.volumes,
        [{
          name = "nix-store"
          persistentVolumeClaim ={
            claimName = "nix-store-arm64"
          }
        }]
      )
      inputs = {
        parameters = [{
          name = "commit-sha"
        }]
      }
      container = {
        name = "merge-and-copy"
        image = local.ci_image
        command = [
          "/scripts/merge-and-copy.sh"
        ]
        env = concat(
          module.nix_image_builder_workflow.env,
          [
            {name = "COMMIT_SHA", value ="{{inputs.parameters.commit-sha}}"}
          ]
        )
        volumeMounts = concat(
          module.nix_image_builder_workflow.volume_mounts
        )
        resources = {
          requests = {
            memory = "500Mi"
            cpu = "100m"
          }
          limits = {
            memory = "750Mi"
          }
        }
      }
    }
  ]
  tmp_directories = {
    code = {
      mount_path = "/code"
      size_mb = 1024
    }
    tmp = {
      mount_path = "/tmp"
      size_mb = 5000
    }
  }
  config_map_mounts = {
    "${kubernetes_config_map.nix_image_builder_scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
    "${kubernetes_config_map.nix_image_builder_containers.metadata[0].name}" = {
      mount_path = "/etc/containers"
    }
  }
}

resource "kubectl_manifest" "nix_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind = "WorkflowTemplate"
    metadata = {
      name = local.nix_image_builder_name
      namespace = local.namespace
      labels = module.nix_image_builder_workflow.labels
    }
    spec = module.nix_image_builder_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true

  depends_on = [
    kubectl_manifest.pvc
  ]
}

