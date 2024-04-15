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
  }
}

locals {

  /************************************************
  * Label Creation
  ************************************************/
  match_labels = {
    pod-template-id = random_id.pod_template_id.hex
  }

  /************************************************
  * Node Scheduling
  ************************************************/

  input_node_preferences = [for pref, config in var.node_preferences : {
    weight = config.weight
    preference = {
      matchExpressions = [{
        key      = pref
        operator = config.operator
        values   = config.values
      }]
    }
  }]
  node_preferences = concat(
    local.input_node_preferences,
    var.allowed_spot ? module.constants.spot_node_affinity_helm.nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution : []
  )
  node_requirements = {
    nodeSelectorTerms = [{
      matchExpressions = [for key, values in var.node_requirements : { key = key, operator = "In", values = values }]
    }]
  }

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
    [for path, config in var.secret_mounts : {
      name = path
      secret = {
        secretName = path
        optional   = false
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
    name      = name
    mountPath = mount
  }]

  common_dynamic_secret_volume_mounts = [for path, config in local.dynamic_env_secrets_by_provider : {
    name      = path
    mountPath = config.mount_path
  }]

  common_volume_mounts = concat(
    local.common_tmp_volume_mounts,
    local.common_secret_volume_mounts,
    local.common_dynamic_secret_volume_mounts
  )

  dynamic_env_secrets_by_provider = { for config in var.dynamic_secrets : config.secret_provider_class => config }

  /************************************************
  * Tolerations
  ************************************************/
  tolerations = concat(
    var.tolerations,
    var.allowed_spot ? module.constants.spot_node_toleration_helm : []
  )

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
    metadata = { for k, v in {
      labels = module.kube_labels.kube_labels
      annotations = merge({
        "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
      }, var.pod_annotations)
    } : k => v if v != null }
    spec = { for k, v in {
      priorityClassName  = var.priority_class_name
      serviceAccountName = var.service_account
      securityContext = {
        fsGroup = var.mount_owner
      }

      ///////////////////////////
      // Scheduling
      ///////////////////////////
      tolerations = length(local.tolerations) == 0 ? null : local.tolerations

      affinity = merge({
        nodeAffinity = { for k, v in {
          preferredDuringSchedulingIgnoredDuringExecution = length(local.node_preferences) == 0 ? null : local.node_preferences
          requiredDuringSchedulingIgnoredDuringExecution  = length(keys(var.node_requirements)) == 0 ? null : local.node_requirements
        } : k => v if v != null }
      }, module.constants.pod_anti_affinity_helm)
      topologySpreadConstraints = module.constants.topology_spread_zone_preferred
      restartPolicy             = var.restart_policy

      ///////////////////////////
      // Storage
      ///////////////////////////
      volumes = length(local.volumes) == 0 ? null : local.volumes

      /////////////////////////////
      // Containers
      //////////////////////////////
      containers = [for container, config in local.containers : { for k, v in {
        name            = container
        image           = "${config.image}:${config.version}"
        command         = length(config.command) == 0 ? null : config.command
        imagePullPolicy = config.imagePullPolicy

        // NOTE: The order that these env blocks is defined in
        // is incredibly important. Do NOT move them around unless you know what you are doing.
        env = concat(
          local.common_env,
          [for k, v in config.env : {
            name  = k,
            value = v
          }]
        )

        startupProbe = config.healthcheck_type != null ? { for k, v in {
          httpGet = config.healthcheck_type == "HTTP" ? {
            path   = config.healthcheck_route
            port   = config.healthcheck_port
            scheme = "HTTP"
          } : null
          tcpSocket = config.healthcheck_type == "TCP" ? {
            port = config.healthcheck_port
          } : null
          failureThreshold = 120
          periodSeconds    = 1
          timeoutSeconds   = 3
        } : k => v if v != null } : null

        readinessProbe = config.healthcheck_type != null ? { for k, v in {
          httpGet = config.healthcheck_type == "HTTP" ? {
            path   = config.healthcheck_route
            port   = config.healthcheck_port
            scheme = "HTTP"
          } : null
          tcpSocket = config.healthcheck_type == "TCP" ? {
            port = config.healthcheck_port
          } : null
          successThreshold = 1
          failureThreshold = 3
          periodSeconds    = 1
          timeoutSeconds   = 3
        } : k => v if v != null } : null

        livenessProbe = config.healthcheck_type != null ? { for k, v in {
          httpGet = config.healthcheck_type == "HTTP" ? {
            path   = config.healthcheck_route
            port   = config.healthcheck_port
            scheme = "HTTP"
          } : null
          tcpSocket = config.healthcheck_type == "TCP" ? {
            port = config.healthcheck_port
          } : null
          successThreshold = 1
          failureThreshold = 15
          periodSeconds    = 1
          timeoutSeconds   = 3
        } : k => v if v != null } : null

        resources       = local.resources[config.name]
        securityContext = local.security_context[config.name]
        volumeMounts    = length(local.common_volume_mounts) == 0 ? null : local.common_volume_mounts
      } : k => v if v != null }]

      initContainers = length(keys(local.init_containers)) == 0 ? null : [for container, config in local.init_containers : {
        name            = container
        image           = "${config.image}:${config.version}"
        command         = length(config.command) == 0 ? null : config.command
        imagePullPolicy = config.imagePullPolicy
        env = concat(
          local.common_env,
          [for k, v in config.env : {
            name  = k,
            value = v
          }]
        )
        resources       = local.security_context[config.name]
        securityContext = local.security_context[config.name]
        volumeMounts    = length(local.common_volume_mounts) == 0 ? null : local.common_volume_mounts
      }]
    } : k => v if v != null }
  }
}

module "kube_labels" {
  source = "../kube_labels"

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags = merge(var.extra_tags, var.extra_pod_labels, {
    pod-template-id = random_id.pod_template_id.hex
  })
}

module "constants" {
  source = "../constants"

  matching_labels = local.match_labels

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

resource "random_id" "pod_template_id" {
  prefix      = "${var.pf_root_module}-"
  byte_length = 8
}

resource "kubernetes_secret" "secrets" {
  metadata {
    namespace = var.namespace
    name      = replace(random_id.pod_template_id.hex, "_", "-")
    labels    = module.kube_labels.kube_labels
  }
  data = var.secrets
}
