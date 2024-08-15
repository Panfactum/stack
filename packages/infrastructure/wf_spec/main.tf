terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {

  dynamic_env_secrets_by_provider = { for config in var.dynamic_secrets : config.secret_provider_class => config }

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
  common_static_secret_env = [for k in keys(var.common_secrets) : {
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
  * Volumes
  ************************************************/

  common_volumes = concat(
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
        secretName = name
        optional   = config.optional
      }
    }],
    [for name, config in var.config_map_mounts : {
      name = "config-map-${name}"
      configMap = {
        name        = name
        defaultMode = 511 # TODO: Make a flag -- Give all permissions so we can mount executables
        optional    = config.optional
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

  common_tmp_volume_mounts = [for name, config in var.tmp_directories : {
    name      = replace(name, "/[^a-z0-9]/", "")
    mountPath = config.mount_path
  }]

  common_secret_volume_mounts = [for name, config in var.secret_mounts : {
    name      = "secret-${name}"
    mountPath = config.mount_path
    readOnly  = true
  }]

  common_config_map_volume_mounts = [for name, config in var.config_map_mounts : {
    name      = "config-map-${name}"
    mountPath = config.mount_path
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

  /************************************************
  * Container Security Context
  ************************************************/

  security_context = {
    runAsGroup               = var.run_as_root ? 0 : var.uid
    runAsUser                = var.run_as_root ? 0 : var.uid
    runAsNonRoot             = !var.run_as_root
    allowPrivilegeEscalation = var.run_as_root || var.privileged
    readOnlyRootFilesystem   = var.read_only_root_fs
    privileged               = var.privileged
    capabilities = {
      add  = var.linux_capabilities
      drop = var.privileged ? [] : ["ALL"]
    }
  }

  /************************************************
  * Template Defaults
  ************************************************/

  templates = [for template in var.templates :
    { for k, v in merge(
      template,
      {
        # Apply container defaults to all containers in the various template types
        container    = contains(keys(template), "container") ? merge(local.container_defaults, template["container"]) : null
        containerSet = contains(keys(template), "containerSet") ? merge(template["containerSet"], { containers = [for container in template["containerSet"]["containers"] : merge(local.container_defaults, container)] }) : null

        # Volumes are not defaulted by Argo for ContainerSet template types for some reason
        volumes = lookup(template, "volumes", (contains(keys(template), "containerSet") ? local.common_volumes : null))

        # Passthrough parameters in dag references
        dag = contains(keys(template), "dag") ? merge(template["dag"], {
          tasks = [for task in lookup(template["dag"], "tasks", []) : merge(task, {
            arguments = merge(
              lookup(task, "arguments", {}),
              {
                parameters = concat(
                  lookup(lookup(task, "arguments", {}), "parameters", []),
                  local.template_arguments_passthrough_parameters
                )
              }
            )
            hooks = { for hook, config in lookup(task, "hooks", {}) : hook => merge(config, {
              arguments = merge(
                lookup(config, "arguments", {}),
                {
                  parameters = concat(
                    lookup(lookup(config, "arguments", {}), "parameters", []),
                    local.template_arguments_passthrough_parameters
                  )
                }
              )
            }) }
          })]
        }) : null

        # Passthrough parameters in step references
        steps = contains(keys(template), "step") ? [for step_list in template["steps"] : [for step in step_list : merge(step, {
          arguments = merge(
            lookup(step, "arguments", {}),
            {
              parameters = concat(
                lookup(lookup(step, "arguments", {}), "parameters", []),
                local.template_arguments_passthrough_parameters
              )
            }
          )
          hooks = { for hook, config in lookup(step, "hooks", {}) : hook => merge(config, {
            arguments = merge(
              lookup(config, "arguments", {}),
              {
                parameters = concat(
                  lookup(lookup(config, "arguments", {}), "parameters", []),
                  local.template_arguments_passthrough_parameters
                )
              }
            )
          }) }
        })]] : null

        # These need to be set here in order for them to show up on in a templateRef reference to the template;
        # Defining them at the workflow level will not work in this scenario
        affinity           = lookup(template, "affinity", module.util.affinity)
        priorityClassName  = lookup(template, "priorityClassName", var.priority_class_name)
        schedulerName      = lookup(template, "schedulerName", module.util.scheduler_name)
        serviceAccountName = lookup(template, "serviceAccountName", kubernetes_service_account.sa.metadata[0].name)
        tolerations        = lookup(template, "tolerations", module.util.tolerations)
        inputs = merge(
          lookup(template, "inputs", {}),
          {
            parameters = concat(lookup(lookup(template, "inputs", {}), "parameters", []), local.template_inputs_passthrough_parameters)
          }
        )
      },
    ) : k => v if v != null }
  ]

  /************************************************
  * Parameters
  ************************************************/
  cleansed_passthrough_paramters = [for param in var.passthrough_parameters : { for k, v in param : k => v if v != null }]
  workflow_parameters = concat(
    lookup(var.arguments, "parameters", []),
    local.cleansed_passthrough_paramters
  )
  template_inputs_passthrough_parameters = [for param in local.cleansed_passthrough_paramters : merge(
    param,
    {
      default = "{{workflow.parameters.${param.name}}}"
    }
  )]
  template_arguments_passthrough_parameters = [for param in local.cleansed_passthrough_paramters : merge(
    {
      name  = param.name,
      value = "{{inputs.parameters.${param.name}}}"
    }
  )]

  /************************************************
  * Workflow Definition
  ************************************************/
  workflow_spec = { for k, v in {
    activeDeadlineSeconds = var.active_deadline_seconds
    affinity              = module.util.affinity
    archiveLogs           = var.archive_logs_enabled
    artifactGC = var.delete_artifacts_on_deletion ? {
      strategy = "OnWorkflowDeletion"
    } : null
    arguments = {
      artifacts  = lookup(var.arguments, "artifacts", [])
      parameters = local.workflow_parameters
    }
    dnsPolicy   = var.dns_policy
    entrypoint  = var.entrypoint
    onExit      = var.on_exit
    parallelism = var.pod_parallelism
    hooks       = var.hooks
    podGC = {
      labelSelector       = module.util.match_labels
      strategy            = "OnWorkflowCompletion"
      deleteDelayDuration = "${var.pod_delete_delay_seconds}s"
    }
    podMetadata = {
      labels = merge(module.util.labels, var.extra_pod_labels)
      annotations = merge(
        var.pod_annotations,
        var.disruptions_enabled ? {} : {
          # This is required for pods that take a long time to initialize as PDB's won't protect them
          "karpenter.sh/do-not-disrupt" = "true"
        }
      )
    }
    podPriorityClassName = var.priority_class_name
    priority             = var.priority
    retryStrategy = { for k, v in {
      backoff = {
        duration    = "${var.retry_backoff_initial_duration_seconds}s"
        factor      = 2
        maxDuration = "${var.retry_backoff_max_duration_seconds}s"
      }
      limit       = var.retry_max_attempts
      retryPolicy = var.retry_policy
      expression  = var.retry_expression
    } : k => v if v != null }
    schedulerName = module.util.scheduler_name
    securityContext = { for k, v in {
      fsGroup             = var.run_as_root ? null : var.uid # This will trigger a full recursive chown if set, so avoid doing this if the runner is root
      fsGroupChangePolicy = "OnRootMismatch"                 # Provides significant performance increase for mounting caches
      runAsNonRoot        = false                            # Argo's executor must run as root
      runAsUser           = var.run_as_root ? 0 : var.uid
      runAsGroup          = var.run_as_root ? 0 : var.uid
    } : k => v if v != null }
    serviceAccountName = kubernetes_service_account.sa.metadata[0].name
    suspend            = var.suspend
    synchronization = {
      semaphore = {
        configMapKeyRef = {
          name = kubernetes_config_map.parallelism.metadata[0].name
          key  = "workflow"
        }
      }
    }
    templates   = local.templates
    tolerations = module.util.tolerations
    ttlStrategy = {
      secondsAfterCompletion = var.workflow_delete_seconds_after_completion
      secondsAfterFailure    = var.workflow_delete_seconds_after_failure
      secondsAfterSuccess    = var.workflow_delete_seconds_after_success
    }
    volumeClaimGC = {
      strategy = "OnWorkflowCompletion"
    }
    volumeClaimTemplates = [for name, config in var.volume_mounts : {
      metadata = {
        name   = name
        labels = module.util.labels
        annotations = {
          "velero.io/exclude-from-backups" = "true"
        }
      }
      spec = {
        accessModules = config.access_modes
        resources = {
          requests = {
            storage = "${config.access_modes}Gi"
          }
        }
      }
    }]
    volumes = local.common_volumes
    workflowMetadata = {
      labels      = merge(module.util.labels, var.extra_workflow_labels)
      annotations = var.workflow_annotations
    }
    workflowTemplateRef = var.cluster_workflow_template_ref == null ? null : {
      clusterScope = true
      name         = var.cluster_workflow_template_ref
    }
  } : k => v if v != null }

  /************************************************
  * Container Defaults
  ************************************************/
  container_defaults = {
    image           = var.default_container_image
    securityContext = local.security_context
    volumeMounts    = local.common_volume_mounts
    env             = local.common_env
    resources = {
      requests = var.default_resources.requests
      limits   = { for k, v in var.default_resources.limits : k => v if v != null }
    }
  }
}

resource "random_id" "workflow_id" {
  byte_length = 8
  prefix      = "${var.name}-"
}

module "util" {
  source = "../kube_workload_utility"

  workload_name = var.name

  # Scheduling params
  burstable_nodes_enabled               = var.burstable_nodes_enabled
  spot_nodes_enabled                    = var.spot_nodes_enabled
  arm_nodes_enabled                     = var.arm_nodes_enabled
  instance_type_anti_affinity_preferred = false
  instance_type_anti_affinity_required  = false
  zone_anti_affinity_required           = false
  host_anti_affinity_required           = false
  extra_tolerations                     = var.extra_tolerations
  controller_node_required              = var.controller_node_required
  node_requirements                     = var.node_requirements
  node_preferences                      = var.node_preferences
  prefer_spot_nodes_enabled             = var.prefer_spot_nodes_enabled
  prefer_burstable_nodes_enabled        = var.prefer_burstable_nodes_enabled
  prefer_arm_nodes_enabled              = var.prefer_arm_nodes_enabled
  topology_spread_enabled               = false
  topology_spread_strict                = false
  panfactum_scheduler_enabled           = var.panfactum_scheduler_enabled
  lifetime_evictions_enabled            = false

  # pf-generate: set_vars
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

resource "kubernetes_service_account" "sa" {
  metadata {
    name      = random_id.workflow_id.hex
    namespace = var.namespace
    labels    = module.util.labels
  }
}

module "workflow_perms" {
  source                    = "../kube_sa_auth_workflow"
  service_account           = kubernetes_service_account.sa.metadata[0].name
  service_account_namespace = var.namespace
  eks_cluster_name          = var.eks_cluster_name
  extra_aws_permissions     = var.extra_aws_permissions

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

resource "kubernetes_config_map" "parallelism" {
  metadata {
    name      = "${random_id.workflow_id.hex}-sync"
    namespace = var.namespace
    labels    = module.util.labels
  }
  data = {
    workflow = tostring(var.workflow_parallelism)
  }
}

resource "kubernetes_secret" "secrets" {
  metadata {
    namespace = var.namespace
    name      = random_id.workflow_id.hex
    labels    = module.util.labels
  }
  data = var.common_secrets
}

resource "kubectl_manifest" "pdb" {
  count = var.disruptions_enabled ? 0 : 1
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = random_id.workflow_id.hex
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      selector = {
        matchLabels = module.util.match_labels
      }
      # Must be minAvailable b/c this is argo Workflow CRD doesn't implement the scale subresource
      minAvailable = 100
    }
  })
  force_conflicts   = true
  server_side_apply = true
}

