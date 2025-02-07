terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  namespace = "gha"

  runner_images = {
    for runner, config in var.runners : runner => {
      registry   = config.action_runner_image_registry
      repository = config.action_runner_image_repository
      tag        = config.action_runner_image_tag
    }
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_gha_runners"
}

/***************************************
* Runners
***************************************/

module "util" {
  for_each = var.runners
  source   = "../kube_workload_utility"

  workload_name                        = each.key
  burstable_nodes_enabled              = false
  spot_nodes_enabled                   = each.value.spot_nodes_enabled
  arm_nodes_enabled                    = each.value.arm_nodes_enabled
  controller_nodes_enabled             = false
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false
  az_spread_preferred                  = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_listener" {
  for_each = var.runners
  source   = "../kube_workload_utility"

  workload_name                        = each.key
  burstable_nodes_enabled              = true
  spot_nodes_enabled                   = true
  arm_nodes_enabled                    = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false
  az_spread_preferred                  = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

resource "kubernetes_secret" "creds" {
  metadata {
    name      = "gha-creds"
    namespace = local.namespace
  }
  data = {
    github_token = var.github_token
  }
}
resource "kubernetes_secret" "secrets" {
  metadata {
    name      = "runner-shared-secrets"
    namespace = local.namespace
  }
  data = var.extra_env_secrets
}

resource "kubernetes_service_account" "runners" {
  metadata {
    name      = "gha-runners"
    namespace = local.namespace
  }
}

resource "kubernetes_role" "runners" {
  metadata {
    name      = "gha-runners"
    namespace = local.namespace
  }
  rule {
    api_groups = [""]
    resources  = ["pods"]
    verbs      = ["get", "list", "create", "delete"]
  }
  rule {
    api_groups = [""]
    resources  = ["pods/exec"]
    verbs      = ["get", "create"]
  }
  rule {
    api_groups = [""]
    resources  = ["pods/log"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["batch"]
    resources  = ["jobs"]
    verbs      = ["get", "list", "create", "delete"]
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["get", "list", "create", "delete"]
  }
}

resource "kubernetes_role_binding" "runners" {
  metadata {
    name      = "gha-runners"
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.runners.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.runners.metadata[0].name
    namespace = local.namespace
  }
}

resource "helm_release" "runner" {
  for_each        = var.runners
  namespace       = local.namespace
  name            = each.key
  repository      = "oci://ghcr.io/actions/actions-runner-controller-charts/"
  chart           = "gha-runner-scale-set"
  version         = var.gha_runner_scale_set_helm_version
  recreate_pods   = false
  atomic          = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  force_update    = true
  max_history     = 5

  values = [
    yamlencode({
      githubConfigUrl    = each.value.github_config_url
      githubConfigSecret = kubernetes_secret.creds.metadata[0].name
      minRunners         = each.value.min_replicas
      maxRunners         = each.value.max_replicas
      runnerScaleSetName = each.key

      // Note that this does NOT work and it seems to be an issue with how GHA is trying to share
      // files between the runner and the job container. See issue
      // https://github.com/actions/actions-runner-controller/discussions/2438.
      // It does not seem like GitHub is interested in prioritizing support for EKS at this time
      // so consider this unsupported for now even though we have it configured as per GitHub's docs.
      containerMode = {
        type = "kubernetes"
        kubernetesModeWorkVolumeClaim = {
          accessModes      = ["ReadWriteOnce"]
          storageClassName = "ebs-standard"
          resources = {
            requests = {
              storage = "${each.value.tmp_space_gb}Gi"
            }
          }
        }
      }

      listenerTemplate = {
        spec = {
          containers = [
            {
              name = "listener"
              resources = {
                requests = {
                  cpu    = "10m"
                  memory = "15Mi"
                }
                limits = {
                  memory = "30Mi"
                }
              }
              securityContext = {
                readOnlyRootFilesystem   = true
                allowPrivilegeEscalation = false
                capabilities = {
                  drop = ["all"]
                }
                privileged   = false
                runAsNonRoot = true
              }
            }
          ]
          tolerations   = module.util_listener[each.key].tolerations
          schedulerName = module.util_listener[each.key].scheduler_name
          affinity      = module.util_listener[each.key].affinity
        }
      }

      template = {
        metadata = {
          labels = merge(
            module.util[each.key].labels,
            var.extra_pod_labels
          )
          annotations = var.extra_pod_annotations
        }
        spec = {
          schedulerName                 = module.util[each.key].scheduler_name
          tolerations                   = module.util[each.key].tolerations
          serviceAccountName            = kubernetes_service_account.runners.metadata[0].name
          terminationGracePeriodSeconds = 90


          // Once the runner exits / finishes, it should never try to restart
          // as the lifecycle is handled by the scale set controller
          restartPolicy = "Never"

          securityContext = {
            fsGroup = 1001 // Must be set in order to allow runner to access ephemeral volume
          }

          containers = [
            {
              name  = "runner"
              image = "${local.runner_images[each.key].registry}/${local.runner_images[each.key].repository}:${local.runner_images[each.key].tag}"
              command = [
                "/home/runner/run.sh",
                "--labels=${each.key}"
              ]
              env = [
                {
                  name  = "ACTIONS_RUNNER_CONTAINER_HOOKS"
                  value = "/home/runner/k8s/index.js"
                },
                {
                  name = "ACTIONS_RUNNER_POD_NAME"
                  valueFrom = {
                    fieldRef = {
                      fieldPath = "metadata.name"
                    }
                  }
                },
                {
                  name  = "ACTIONS_RUNNER_REQUIRE_JOB_CONTAINER"
                  value = "false"
                }
              ]
              envFrom = [
                {
                  secretRef = {
                    name     = kubernetes_secret.common_env.metadata[0].name
                    optional = false
                  }
                }
              ]
              resources = {
                requests = {
                  cpu               = "${each.value.cpu_millicores}m"
                  memory            = "${each.value.memory_mb}Mi"
                  ephemeral-storage = "25Mi"
                }
                limits = {
                  memory = "${floor(each.value.memory_mb * 1.3)}Mi"
                  // we do need to limit cpu so as not to disrupt development with bursty workloads
                  cpu               = "${each.value.cpu_millicores * 2}m"
                  ephemeral-storage = "100Mi"
                }
              }
              securityContext = {
                readOnlyRootFilesystem   = false
                allowPrivilegeEscalation = false
                capabilities = {
                  drop = ["ALL"]
                }
              }
              volumeMounts = [
                {
                  name      = "work"
                  mountPath = "/home/runner/_work"
                }
              ]
            }
          ]
          volumes = [{
            name = "work"
            ephemeral = {
              volumeClaimTemplate = {
                spec = {
                  accessModes      = ["ReadWriteOnce"]
                  storageClassName = "ebs-standard"
                  volumeMode       = "Filesystem"
                  resources = {
                    requests = {
                      storage = "${each.value.tmp_space_gb}Gi"
                    }
                  }
                }
              }
            }
          }]
        }
      }

      controllerServiceAccount = {
        namespace = local.namespace
        name      = "gha-scale-set-controller"
      }
    })
  ]
}

resource "kubernetes_secret" "common_env" {
  metadata {
    name      = "common-runner-secrets"
    namespace = local.namespace
  }
  data = var.extra_env_secrets
}

resource "kubectl_manifest" "pdb" {
  for_each = var.runners
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = each.key
      namespace = local.namespace
      labels    = module.util[each.key].labels
    }
    spec = {
      selector = {
        matchLabels = module.util[each.key].match_labels
      }
      maxUnavailable = 0
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.runner]
}

module "image_cache" {
  source = "../kube_node_image_cache"
  images = [for config in values({ for image in local.runner_images : "${image.registry}/${image.repository}:${image.tag}" => {
    registry   = image.registry
    repository = image.repository
    image_tag  = image.tag
  }... }) : try(config[0], config)]
}