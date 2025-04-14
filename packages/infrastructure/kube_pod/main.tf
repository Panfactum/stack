terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
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

data "pf_kube_labels" "labels" {
  module = "kube_pod"
}

locals {

  /************************************************
  * Container Segmentation
  ************************************************/

  containers      = { for container in var.containers : container.name => container if container.init == false }
  init_containers = { for container in var.containers : container.name => container if container.init == true }

  /************************************************
  * Environment variables
  ************************************************/

  // Static env variables (non-secret)
  common_static_env = [for k, v in var.common_env : {
    name  = k
    value = v == "" ? null : v
  }]

  // Static env variables (secret)
  common_static_secret_env = [for k in keys(var.common_secrets) : {
    name = k
    valueFrom = {
      secretKeyRef = {
        name     = kubernetes_secret.secrets[0].metadata[0].name
        key      = k
        optional = false
      }
    }
  }]

  // Environment variables from preexisting Secrets
  common_secret_key_ref_env = [for k, v in var.common_env_from_secrets : {
    name = k
    valueFrom = {
      secretKeyRef = {
        name     = v.secret_name
        key      = v.key
        optional = false
      }
    }
  }]

  // Environment variables from preexisting ConfigMaps
  common_config_map_key_ref_env = [for k, v in var.common_env_from_config_maps : {
    name = k
    valueFrom = {
      configMapKeyRef = {
        name     = v.config_map_name
        key      = v.key
        optional = false
      }
    }
  }]

  // All common env
  // NOTE: The order that these env blocks is defined in
  // is incredibly important. Do NOT move them around unless you know what you are doing.
  common_env = concat(
    local.common_static_secret_env,
    local.common_secret_key_ref_env,
    local.common_config_map_key_ref_env,
    local.common_static_env
  )


  /************************************************
  * Storage Setup
  ************************************************/

  // Note: Sum cannot take an empty array so we concat 0
  total_tmp_storage_mb = sum(concat([for name, config in var.tmp_directories : config.size_mb if config.node_local], [0]))

  volumes = concat(
    [for name, config in var.tmp_directories : {
      name = replace(name, "/[^a-z0-9]/", "")
      emptyDir = {
        sizeLimit = "${config.size_mb}Mi"
      }
    } if config.node_local],
    [for name, config in var.tmp_directories : {
      name = replace(name, "/[^a-z0-9]/", "")
      ephemeral = {
        volumeClaimTemplate = {
          metadata = {
            annotations = {
              "velero.io/exclude-from-backups" = "true" // ephemeral storage shouldn't be backed up
            }
          }
          spec = {
            accessModes      = ["ReadWriteOnce"]
            storageClassName = "ebs-standard"
            volumeMode       = "Filesystem"
            resources = {
              requests = {
                storage = "${config.size_mb}Mi"
              }
            }
          }
        }
      }
    } if !config.node_local],
    [for name, config in var.secret_mounts : {
      name = "secret-${name}"
      secret = {
        secretName  = name
        defaultMode = 361 # 551 in octal - Give all permissions so we can mount executables
        optional    = config.optional
      }
    }],
    [for name, config in var.config_map_mounts : {
      name = "config-map-${name}"
      configMap = {
        name        = name
        defaultMode = 361 # 551 in octal - Give all permissions so we can mount executables
        optional    = config.optional
      }
    }],
    [{
      name = "podinfo",
      downwardAPI = {
        items = [
          {
            path = "labels",
            fieldRef = {
              fieldPath = "metadata.labels"
            }
          },
          {
            path = "annotations",
            fieldRef = {
              fieldPath = "metadata.annotations"
            }
          }
        ]
      }
    }]
  )

  /************************************************
  * Mounts
  ************************************************/

  common_tmp_volume_mounts = [for name, config in var.tmp_directories : {
    name      = replace(name, "/[^a-z0-9]/", "")
    mountPath = config.mount_path
  }]

  common_extra_volume_mounts = [for name, config in var.extra_volume_mounts : {
    name      = name
    mountPath = config.mount_path
  }]

  common_secret_volume_mounts = flatten([for name, config in var.secret_mounts : length(config.sub_paths) > 0 ?
    [for sub_path in config.sub_paths : {
      name      = "secret-${name}"
      mountPath = "${config.mount_path}/${sub_path}"
      subPath   = sub_path
      readOnly  = true
    }]
    : [{
      name      = "secret-${name}"
      mountPath = config.mount_path
      readOnly  = true
      subPath   = null
  }]])

  common_config_map_volume_mounts = flatten([for name, config in var.config_map_mounts : length(config.sub_paths) > 0 ?
    [for sub_path in config.sub_paths : {
      name      = "config-map-${name}"
      mountPath = "${config.mount_path}/${sub_path}"
      subPath   = sub_path
      readOnly  = true
      }] : [{
      name      = "config-map-${name}"
      mountPath = config.mount_path
      readOnly  = true
      subPath   = null
  }]])

  common_downward_api_mounts = [{
    name      = "podinfo"
    mountPath = "/etc/podinfo"
  }]

  common_volume_mounts = concat(
    local.common_tmp_volume_mounts,
    local.common_extra_volume_mounts,
    local.common_secret_volume_mounts,
    local.common_config_map_volume_mounts,
    local.common_downward_api_mounts
  )

  /************************************************
  * Tolerations
  ************************************************/
  tolerations = module.util.tolerations

  /************************************************
  * Resource Calculations
  ************************************************/
  // Note: we always give 100Mi of scratch space for logs, etc.
  resources = { for container in var.containers : container.name => {
    requests = {
      cpu               = "${container.minimum_cpu}m"
      memory            = container.minimum_memory * 1024 * 1024
      ephemeral-storage = "${local.total_tmp_storage_mb + 100}Mi"
    }
    limits = { for k, v in {
      cpu               = container.maximum_cpu != null ? "${container.maximum_cpu}m" : null
      memory            = floor(container.minimum_memory * 1024 * 1024 * container.memory_limit_multiplier)
      ephemeral-storage = "${local.total_tmp_storage_mb + 100}Mi"
    } : k => v if v != null }
  } }

  /************************************************
  * Security Contexts
  ************************************************/
  // Note: we allow some extra permissions when running in local dev mode
  security_context = {
    for container in var.containers : container.name => {
      runAsGroup               = container.run_as_root ? 0 : container.uid
      runAsUser                = container.run_as_root ? 0 : container.uid
      runAsNonRoot             = !container.run_as_root
      allowPrivilegeEscalation = container.run_as_root || container.privileged || contains(container.linux_capabilities, "SYS_ADMIN")
      readOnlyRootFilesystem   = container.read_only
      privileged               = container.privileged
      capabilities = {
        add  = container.linux_capabilities
        drop = container.privileged ? [] : ["ALL"]
      }
    }
  }

  /************************************************
  * Pod Spec
  * Note: The extra inner k,v loop is to remove k,v pairs with null v's
  * which aren't always accepted by the k8s api
  ************************************************/

  pod = {
    metadata = {
      labels = merge(
        var.pod_version_labels_enabled ? module.util.labels : {
          for k, v in module.util.labels : k => v if !contains([
            "panfactum.com/stack-commit",
            "panfactum.com/stack-version",
            "panfactum.com/version",
            "panfactum.com/commit"
          ], k)
        },
        var.extra_pod_labels
      )
      annotations = merge(
        {
          "linkerd.io/inject" = var.linkerd_enabled ? "enabled" : "disabled"
        },
        var.extra_pod_annotations
      )
    }
    spec = {
      priorityClassName  = var.priority_class_name
      serviceAccountName = var.service_account
      securityContext = {
        fsGroup             = var.mount_owner
        fsGroupChangePolicy = "OnRootMismatch" # Provides significant performance increase
      }
      dnsPolicy   = var.dns_policy
      hostNetwork = var.host_network

      ///////////////////////////
      // Scheduling
      ///////////////////////////
      schedulerName                 = var.panfactum_scheduler_enabled ? "panfactum" : null
      tolerations                   = module.util.tolerations
      affinity                      = module.util.affinity
      topologySpreadConstraints     = module.util.topology_spread_constraints
      restartPolicy                 = var.restart_policy
      terminationGracePeriodSeconds = var.termination_grace_period_seconds

      ///////////////////////////
      // Storage
      ///////////////////////////
      volumes = length(local.volumes) == 0 ? null : local.volumes

      /////////////////////////////
      // Containers
      //////////////////////////////
      containers = [for container, config in local.containers : {
        name            = container
        image           = "${config.image_registry}/${config.image_repository}:${config.image_tag}"
        command         = length(config.command) == 0 ? null : config.command
        imagePullPolicy = config.image_pull_policy
        workingDir      = config.working_dir

        // NOTE: The order that these env blocks is defined in
        // is incredibly important. Do NOT move them around unless you know what you are doing.
        env = concat(
          local.common_env,
          [for k, v in config.env : {
            name  = k,
            value = v
          }]
        )

        ports = [for name, config in config.ports : {
          name          = name
          protocol      = config.protocol
          containerPort = config.port
        }]

        startupProbe = config.liveness_probe_type != null ? {
          httpGet = config.liveness_probe_type == "HTTP" ? {
            path   = config.liveness_probe_route
            port   = config.liveness_probe_port
            scheme = config.liveness_probe_scheme
          } : null
          tcpSocket = config.liveness_probe_type == "TCP" ? {
            port = config.liveness_probe_port
          } : null
          exec = lower(config.liveness_probe_type) == "exec" ? {
            command = config.liveness_probe_command
          } : null
          failureThreshold = 120
          periodSeconds    = 1
          timeoutSeconds   = 3
        } : null

        readinessProbe = config.liveness_probe_type != null ? {
          httpGet = lower(config.readiness_probe_type != null ? config.readiness_probe_type : config.liveness_probe_type) == "http" ? {
            path   = config.readiness_probe_route != null ? config.readiness_probe_route : config.liveness_probe_route
            port   = config.readiness_probe_port != null ? config.readiness_probe_port : config.liveness_probe_port
            scheme = config.readiness_probe_scheme != null ? config.readiness_probe_scheme : config.liveness_probe_scheme
          } : null
          tcpSocket = lower(config.readiness_probe_type != null ? config.readiness_probe_type : config.liveness_probe_type) == "tcp" ? {
            port = config.readiness_probe_port != null ? config.readiness_probe_port : config.liveness_probe_port
          } : null
          exec = lower(config.readiness_probe_type != null ? config.readiness_probe_type : config.liveness_probe_type) == "exec" ? {
            command = config.readiness_probe_command != null ? config.readiness_probe_command : config.liveness_probe_command
          } : null
          successThreshold = 1
          failureThreshold = 3
          periodSeconds    = 1
          timeoutSeconds   = 3
        } : null

        livenessProbe = config.liveness_probe_type != null ? {
          httpGet = lower(config.liveness_probe_type) == "http" ? {
            path   = config.liveness_probe_route
            port   = config.liveness_probe_port
            scheme = config.liveness_probe_scheme
          } : null
          tcpSocket = lower(config.liveness_probe_type) == "tcp" ? {
            port = config.liveness_probe_port
          } : null
          exec = lower(config.liveness_probe_type) == "exec" ? {
            command = config.liveness_probe_command
          } : null
          successThreshold = 1
          failureThreshold = 15
          periodSeconds    = 1
          timeoutSeconds   = 3
        } : null

        resources       = local.resources[config.name]
        securityContext = local.security_context[config.name]
        volumeMounts    = length(local.common_volume_mounts) == 0 ? null : local.common_volume_mounts
      }]

      initContainers = length(keys(local.init_containers)) == 0 ? null : [for container, config in local.init_containers : {
        name            = container
        image           = "${config.image_registry}/${config.image_repository}:${config.image_tag}"
        command         = length(config.command) == 0 ? null : config.command
        imagePullPolicy = config.image_pull_policy
        workingDir      = config.working_dir
        env = concat(
          local.common_env,
          [for k, v in config.env : {
            name  = k,
            value = v
          }]
        )
        resources       = local.resources[config.name]
        securityContext = local.security_context[config.name]
        volumeMounts    = length(local.common_volume_mounts) == 0 ? null : local.common_volume_mounts
      }]
    }
  }
}

module "util" {
  source = "../kube_workload_utility"

  workload_name                        = var.workload_name
  match_labels                         = var.match_labels
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  controller_nodes_required            = var.controller_nodes_required
  cilium_required                      = var.cilium_required
  linkerd_required                     = var.linkerd_enabled && var.linkerd_required
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required
  az_anti_affinity_required            = var.az_anti_affinity_required
  host_anti_affinity_required          = var.host_anti_affinity_required
  extra_tolerations                    = var.extra_tolerations
  az_spread_preferred                  = var.az_spread_preferred
  az_spread_required                   = var.az_spread_required
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  node_requirements                    = var.node_requirements
  node_preferences                     = var.node_preferences
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  lifetime_evictions_enabled           = var.lifetime_evictions_enabled

  extra_labels = merge(
    data.pf_kube_labels.labels.labels,
    var.extra_labels # Allow the caller to override so the module label can be set appropriately
  )
}

module "constants" {
  source = "../kube_constants"
}

/************************************************
* Protects the secret config values
************************************************/

resource "kubernetes_secret" "secrets" {
  count = length(keys(var.common_secrets)) > 0 ? 1 : 0

  metadata {
    namespace     = var.namespace
    generate_name = "${var.workload_name}-"
    labels        = merge(module.util.labels, data.pf_kube_labels.labels.labels)
  }
  data = var.common_secrets
}

/************************************************
* Allows the pod to read its own manifest
************************************************/

resource "kubernetes_role" "pod_reader" {
  count = var.default_permissions_enabled ? 1 : 0

  metadata {
    namespace     = var.namespace
    generate_name = "${var.workload_name}-"
    labels        = merge(module.util.labels, data.pf_kube_labels.labels.labels)
  }
  rule {
    api_groups = [""]
    resources  = ["pods"]
    verbs      = ["list", "get"]
  }
}

resource "kubernetes_role_binding" "pod_reader" {
  count = var.default_permissions_enabled ? 1 : 0

  metadata {
    namespace     = var.namespace
    generate_name = "${var.workload_name}-"
    labels        = merge(module.util.labels, data.pf_kube_labels.labels.labels)
  }
  subject {
    kind      = "ServiceAccount"
    name      = var.service_account == null ? "default" : var.service_account
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.pod_reader[0].metadata[0].name
  }
}

/************************************************
* Caches the pod's images on the node
************************************************/

module "image_cache" {
  count  = anytrue([for container in var.containers : (container.image_pin_enabled || container.image_prepull_enabled)]) ? 1 : 0
  source = "../kube_node_image_cache"

  images = [for config in values({ for container in var.containers : "${container.image_registry}/${container.image_repository}:${container.image_tag}" => {
    registry          = container.image_registry
    repository        = container.image_repository
    tag               = container.image_tag
    prepull_enabled   = container.image_prepull_enabled
    pin_enabled       = container.image_pin_enabled
    arm_nodes_enabled = var.arm_nodes_enabled
    amd_nodes_enabled = true
  }... }) : try(config[0], config)]
}
