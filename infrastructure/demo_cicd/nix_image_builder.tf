locals {
  nix_image_builder_name = "nix-image-builder"
}

#############################################################
# AWS Permissions
#
# This policy gives the Workflow the ability to upload
# and download images from the repository
#############################################################

data "aws_iam_policy_document" "nix_builder_ecr" {
  statement {
    sid    = "PrivateECR"
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
    sid       = "PrivateECRAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid    = "PublicECR"
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
    sid    = "PublicECRAuth"
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
    name      = "${local.nix_image_builder_name}-scripts"
    labels    = module.nix_image_builder_workflow.labels
    namespace = local.namespace
  }
  data = {
    "build-and-push.sh" = file("${path.module}/nix_image_builder/build-and-push.sh")
    "check-image.sh"    = file("${path.module}/nix_image_builder/check-image.sh")
    "merge-and-copy.sh" = file("${path.module}/nix_image_builder/merge-and-copy.sh")
  }
}

# This is required for some reason by the pkgs.dockerTools
# nix derivation to work
resource "kubernetes_config_map" "nix_image_builder_containers" {
  metadata {
    name      = "${local.nix_image_builder_name}-containers"
    labels    = module.nix_image_builder_workflow.labels
    namespace = local.namespace
  }
  data = {
    "policy.json" = file("${path.module}/nix_image_builder/policy.json")
  }
}

module "nix_image_builder_workflow" {
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name                               = local.nix_image_builder_name
  namespace                          = local.namespace
  burstable_nodes_enabled            = true
  active_deadline_seconds            = 60 * 120
  retry_backoff_max_duration_seconds = 60 * 5
  retry_max_attempts                 = 3

  # These are generally not advised to use
  # for security reasons but are required by nix to build
  # the flake
  run_as_root = true
  read_only   = false
  privileged  = true

  entrypoint = "build-image"
  arguments = {
    parameters = [
      {
        name        = "git_ref"
        description = "Which commit to check out and build in the panfactum/stack repository"
        default     = "main"
      }
    ]
  }
  common_env = {
    GIT_REF               = "{{workflow.parameters.git_ref}}"
    IMAGE_REPO            = "panfactum"
    PUBLIC_IMAGE_REGISTRY = "public.ecr.aws/t8f0s7h5"
    IMAGE_REGISTRY        = "891377197483.dkr.ecr.us-east-2.amazonaws.com"
    IMAGE_REGION          = "us-east-2"
  }
  extra_aws_permissions = data.aws_iam_policy_document.nix_builder_ecr.json
  templates = [
    {
      name = "build-image",
      dag = {
        tasks = [
          {
            name     = "check-image"
            template = "check-image"
          },
          {
            name     = "build-and-push"
            template = "build-and-push"
            depends  = "check-image"
            when     = "{{tasks.check-image.outputs.parameters.needs-build-amd64}} == true"
            arguments = {
              parameters = [{
                name  = "arch"
                value = "amd64"
              }]
            }
          },
          {
            name     = "build-and-push-arm"
            template = "build-and-push"
            depends  = "check-image"
            when     = "{{tasks.check-image.outputs.parameters.needs-build-arm64}} == true"
            arguments = {
              parameters = [{
                name  = "arch"
                value = "arm64"
              }]
            }
          },
          {
            name     = "merge-and-copy"
            template = "merge-and-copy"
            depends  = "(build-and-push.Succeeded || build-and-push.Skipped) && (build-and-push-arm.Succeeded || build-and-push-arm.Skipped)"
            when     = "{{tasks.check-image.outputs.parameters.needs-merge}} == true"
            arguments = {
              parameters = [{
                name  = "commit-sha"
                value = "{{tasks.check-image.outputs.parameters.commit-sha}}"
              }]
            }
          }
        ]
      }
    },
    {
      name = "check-image"
      outputs = {
        parameters = [
          {
            name = "needs-build-amd64"
            valueFrom = {
              path = "/tmp/needs-build-amd64"
            }
          },
          {
            name = "needs-build-arm64"
            valueFrom = {
              path = "/tmp/needs-build-arm64"
            }
          },
          {
            name = "needs-merge"
            valueFrom = {
              path = "/tmp/needs-merge"
            }
          },
          {
            name = "commit-sha"
            valueFrom = {
              path = "/tmp/commit-sha"
            }
          }
        ]
      }
      container = {
        name  = "check-image"
        image = local.ci_image
        command = [
          "/scripts/check-image.sh"
        ]
        env = module.nix_image_builder_workflow.env
        volumeMounts = concat(
          module.nix_image_builder_workflow.volume_mounts
        )
        resources = {
          requests = {
            memory = "512Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "512Mi"
          }
        }
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
                key      = "kubernetes.io/arch"
                operator = "In"
                values   = ["{{inputs.parameters.arch}}"]
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
      container = {
        name  = "main"
        image = "${module.pull_through.docker_hub_registry}/nixos/nix:2.34.4"
        command = [
          "/scripts/build-and-push.sh"
        ]
        env = concat(
          module.nix_image_builder_workflow.env,
          [
            { name = "ARCH", value = "{{inputs.parameters.arch}}" }
          ]
        )
        volumeMounts = module.nix_image_builder_workflow.volume_mounts
        resources = {
          requests = {
            memory = "32Gi"
            cpu    = "1000m"
          }
          limits = {
            memory = "32Gi"
          }
        }
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
      inputs = {
        parameters = [{
          name = "commit-sha"
        }]
      }
      container = {
        name  = "merge-and-copy"
        image = local.ci_image
        command = [
          "/scripts/merge-and-copy.sh"
        ]
        env = concat(
          module.nix_image_builder_workflow.env,
          [
            { name = "COMMIT_SHA", value = "{{inputs.parameters.commit-sha}}" }
          ]
        )
        volumeMounts = concat(
          module.nix_image_builder_workflow.volume_mounts
        )
        resources = {
          requests = {
            memory = "1000Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "1500Mi"
          }
        }
      }
    }
  ]
  tmp_directories = {
    code = {
      mount_path = "/code"
      size_mb    = 1024
    }
    tmp = {
      mount_path = "/tmp"
      size_mb    = 5000
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
    kind       = "WorkflowTemplate"
    metadata = {
      name      = local.nix_image_builder_name
      namespace = local.namespace
      labels    = module.nix_image_builder_workflow.labels
    }
    spec = module.nix_image_builder_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}

