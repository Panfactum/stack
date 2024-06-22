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
    "merge-manifests.sh" = file("${path.module}/nix_image_builder/merge-manifests.sh")
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
  source                    = "../../../../../infrastructure//kube_workflow" #pf-update

  name = local.nix_image_builder_name
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  burstable_nodes_enabled = true
  panfactum_scheduler_enabled = true
  active_deadline_seconds = 60 * 60

  # These are generally not advised to use
  # for security reasons but are required by nix to build
  # the flake
  run_as_root = true
  read_only_root_fs = false
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
            name = "merge-manifests"
            template = "merge-manifests"
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
      containerSet = {
        containers = [
          {
            name = "init-store"
            image = "${module.pull_through.docker_hub_registry}/nixos/nix"
            command = [
              "/scripts/init-store.sh"
            ]
            env = module.nix_image_builder_workflow.env
            securityContext = module.nix_image_builder_workflow.container_security_context
            volumeMounts = concat(
              module.nix_image_builder_workflow.volume_mounts,
              [{
                name = "nix-store"
                mountPath = "/nix2"
              }]
            )
          },
          {
            name = "builder"
            image = "${module.pull_through.docker_hub_registry}/nixos/nix"
            command = [
              "/scripts/build-and-push.sh"
            ]
            env = concat(
              module.nix_image_builder_workflow.env,
              [
                {name = "GIT_REF", value = "{{workflow.parameters.git_ref}}"},
                {name = "ARCH", value = "{{inputs.parameters.arch}}"}
              ]
            )
            securityContext = module.nix_image_builder_workflow.container_security_context
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
      name = "merge-manifests"
      tolerations = concat(
        module.nix_image_builder_workflow.tolerations,
        [{
          key      = "arm64"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        }]
      )
      volumes = module.nix_image_builder_workflow.volumes
      container = {
        name = "merger"
        image = "${module.pull_through.docker_hub_registry}/nixos/nix"
        command = [
          "/scripts/merge-manifests.sh"
        ]
        env = concat(
          module.nix_image_builder_workflow.env,
          [
            {name = "GIT_REF", value ="{{workflow.parameters.git_ref}}"}
          ]
        )
        securityContext = module.nix_image_builder_workflow.container_security_context
        volumeMounts = module.nix_image_builder_workflow.volume_mounts
        resources = {
          requests = {
            memory = "200Mi"
            cpu = "100m"
          }
          limits = {
            memory = "200Mi"
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
      size_mb = 100
      node_local = true
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
  secrets = {
    GITHUB_TOKEN = var.github_token
  }

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

resource "kubectl_manifest" "workflow_template" {
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

