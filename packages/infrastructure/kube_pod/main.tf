terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
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

  // Always set env vars
  static_env = {
    // Set some Node.js runtime options
    AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
  }

  // Reflective env variables
  common_reflective_env = [
    {
      name = "POD_IP"
      valueFrom = {
        fieldRef = {
          apiVersion = "v1"
          fieldPath  = "status.podIP"
        }
      }
    },
    {
      name = "POD_NAME"
      valueFrom = {
        fieldRef = {
          apiVersion = "v1"
          fieldPath  = "metadata.name"
        }
      }
    },
    {
      name = "POD_NAMESPACE"
      valueFrom = {
        fieldRef = {
          apiVersion = "v1"
          fieldPath  = "metadata.namespace"
        }
      }
    },
    {
      name = "NAMESPACE"
      valueFrom = {
        fieldRef = {
          apiVersion = "v1"
          fieldPath  = "metadata.namespace"
        }
      }
    }
  ]

  // Static env variables (non-secret)
  common_static_env = [for k, v in merge(var.common_env, local.static_env) : {
    name  = k
    value = v == "" ? null : v
  }]

  // Static env variables (secret)
  common_static_secret_env = [for k in keys(var.secrets) : {
    name = k
    valueFrom = {
      secretKeyRef = {
        name     = kubernetes_secret.secrets.metadata[0].name
        key      = k
        optional = false
      }
    }
  }]

  // Secrets mounts
  common_secret_mounts_env = [for k, config in local.dynamic_env_secrets_by_provider : {
    name  = config.env_var
    value = config.mount_path
  }]

  // All common env
  // NOTE: The order that these env blocks is defined in
  // is incredibly important. Do NOT move them around unless you know what you are doing.
  common_env = concat(
    local.common_reflective_env,
    local.common_static_env,
    local.common_static_secret_env,
    local.common_secret_mounts_env
  )


  /************************************************
  * Storage Setup
  ************************************************/

  // Note: Sum cannot take an empty array so we concat 0
  total_tmp_storage_mb = sum(concat([for dir, config in var.tmp_directories : config.size_gb * 1024], [0]))

  volumes = concat(
    [for path, config in var.tmp_directories : {
      name = replace(path, "/[^a-z0-9]/", "")
      emptyDir = {
        sizeLimit = "${config.size_gb}Gi"
      }
    }],
    [for name, config in var.secret_mounts : {
      name = "secret-${name}"
      secret = {
        secretName = name
        optional   = false
      }
    }],
    [for name, config in var.config_map_mounts : {
      name = "config-map-${name}"
      configMap = {
        name     = name
        optional = false
      }
    }],
    [for path, config in local.dynamic_env_secrets_by_provider : {
      name = path
      csi = {
        driver   = "secrets-store.csi.k8s.io"
        readOnly = true
        volumeAttributes = {
          secretProviderClass = path
        }
      }
    }]
  )

  /************************************************
  * Mounts
  ************************************************/

  common_tmp_volume_mounts = [for path, config in var.tmp_directories : {
    name      = replace(path, "/[^a-z0-9]/", "")
    mountPath = path
  }]

  common_secret_volume_mounts = [for name, mount in var.secret_mounts : {
    name      = "secret-${name}"
    mountPath = mount
    readOnly  = true
  }]

  common_config_map_volume_mounts = [for name, mount in var.config_map_mounts : {
    name      = "config-map-${name}"
    mountPath = mount
    readOnly  = true
  }]

  common_dynamic_secret_volume_mounts = [for path, config in local.dynamic_env_secrets_by_provider : {
    name      = path
    mountPath = config.mount_path
  }]

  common_volume_mounts = concat(
    local.common_tmp_volume_mounts,
    local.common_secret_volume_mounts,
    local.common_config_map_volume_mounts,
    local.common_dynamic_secret_volume_mounts
  )

  dynamic_env_secrets_by_provider = { for config in var.dynamic_secrets : config.secret_provider_class => config }

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
    limits = {
      memory            = container.minimum_memory * 1024 * 1024 * 1.3
      ephemeral-storage = "${local.total_tmp_storage_mb + 100}Mi"
    }
  } }

  /************************************************
  * Security Contexts
  ************************************************/
  // Note: we allow some extra permissions when running in local dev mode
  security_context = {
    for container in var.containers : container.name => {
      runAsGroup               = container.run_as_root ? 0 : var.is_local ? 0 : 1000
      runAsUser                = container.run_as_root ? 0 : var.is_local ? 0 : container.uid
      runAsNonRoot             = !container.run_as_root && !var.is_local
      allowPrivilegeEscalation = container.run_as_root || var.is_local
      readOnlyRootFilesystem   = !var.is_local && container.readonly
      capabilities = {
        add  = container.linux_capabilities
        drop = var.is_local ? [] : ["ALL"]
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
      labels = module.util.labels
      annotations = merge({
        "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
      }, var.pod_annotations)
    }
    spec = {
      priorityClassName  = var.priority_class_name
      serviceAccountName = var.service_account
      securityContext = {
        fsGroup = var.mount_owner
      }
      dnsPolicy = var.dns_policy

      ///////////////////////////
      // Scheduling
      ///////////////////////////
      tolerations               = module.util.tolerations
      affinity                  = module.util.affinity
      topologySpreadConstraints = module.util.topology_spread_constraints
      restartPolicy             = var.restart_policy

      ///////////////////////////
      // Storage
      ///////////////////////////
      volumes = length(local.volumes) == 0 ? null : local.volumes

      /////////////////////////////
      // Containers
      //////////////////////////////
      containers = [for container, config in local.containers : {
        name            = container
        image           = "${config.image}:${config.version}"
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

        startupProbe = config.liveness_check_type != null ? {
          httpGet = config.liveness_check_type == "HTTP" ? {
            path   = config.liveness_check_route
            port   = config.liveness_check_port
            scheme = config.liveness_check_scheme
          } : null
          tcpSocket = config.liveness_check_type == "TCP" ? {
            port = config.liveness_check_port
          } : null
          failureThreshold = 120
          periodSeconds    = 1
          timeoutSeconds   = 3
        } : null

        readinessProbe = config.liveness_check_type != null ? {
          httpGet = (config.ready_check_type != null ? config.ready_check_type : config.liveness_check_type) == "HTTP" ? {
            path   = config.ready_check_route != null ? config.ready_check_route : config.liveness_check_route
            port   = config.ready_check_port != null ? config.ready_check_port : config.liveness_check_port
            scheme = config.ready_check_scheme != null ? config.ready_check_scheme : config.liveness_check_scheme
          } : null
          tcpSocket = (config.ready_check_type != null ? config.ready_check_type : config.liveness_check_type) == "TCP" ? {
            port = config.ready_check_port != null ? config.ready_check_port : config.liveness_check_port
          } : null
          successThreshold = 1
          failureThreshold = 3
          periodSeconds    = 1
          timeoutSeconds   = 3
        } : null

        livenessProbe = config.liveness_check_type != null ? {
          httpGet = config.liveness_check_type == "HTTP" ? {
            path   = config.liveness_check_route
            port   = config.liveness_check_port
            scheme = config.liveness_check_scheme
          } : null
          tcpSocket = config.liveness_check_type == "TCP" ? {
            port = config.liveness_check_port
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
        image           = "${config.image}:${config.version}"
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
  source                                = "../kube_workload_utility"
  workload_name                         = var.workload_name
  match_labels                          = var.match_labels
  burstable_nodes_enabled               = var.burstable_nodes_enabled
  spot_nodes_enabled                    = var.spot_nodes_enabled
  arm_nodes_enabled                     = var.arm_nodes_enabled
  instance_type_anti_affinity_preferred = var.instance_type_anti_affinity_preferred
  instance_type_anti_affinity_required  = var.instance_type_anti_affinity_required
  zone_anti_affinity_required           = var.zone_anti_affinity_required
  host_anti_affinity_required           = var.host_anti_affinity_required
  extra_tolerations                     = var.extra_tolerations
  controller_node_required              = var.controller_node_required
  prefer_spot_nodes_enabled             = var.prefer_spot_nodes_enabled
  prefer_burstable_nodes_enabled        = var.prefer_burstable_nodes_enabled
  prefer_arm_nodes_enabled              = var.prefer_arm_nodes_enabled
  topology_spread_enabled               = var.topology_spread_enabled
  topology_spread_strict                = var.topology_spread_strict

  # generate: common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "constants" {
  source = "../kube_constants"
}

resource "kubernetes_secret" "secrets" {
  metadata {
    namespace = var.namespace
    name      = var.workload_name
    labels    = module.util.labels
  }
  data = var.secrets
}
