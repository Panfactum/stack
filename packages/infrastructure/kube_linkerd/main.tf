// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.4"
    }
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_linkerd"
}

locals {
  name      = "linkerd"
  namespace = module.namespace.namespace

  linkerd_root_ca_secret                   = "linkerd-identity-trust-roots" # MUST be named this
  linkerd_root_issuer                      = "linkerd-root-issuer"
  linkerd_identity_issuer                  = "linkerd-identity-issuer"
  linkerd_identity_ca_secret               = "linkerd-identity-issuer"
  linkerd_policy_validator_webhook_secret  = "linkerd-policy-validator-k8s-tls" # MUST be named this
  linkerd_proxy_injector_webhook_secret    = "linkerd-proxy-injector-k8s-tls"   # MUST be named this
  linkerd_profile_validator_webhook_secret = "linkerd-sp-validator-k8s-tls"     # MUST be named this

  linkerd_image_tag = "edge-${substr(var.linkerd_helm_version, 2, -1)}"
}

module "util_cni" {
  source = "../kube_workload_utility"

  workload_name                        = "linkerd-cni"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = false // ds
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false // ds
  az_spread_preferred                  = false // ds
  extra_labels                         = data.pf_kube_labels.labels.labels
  cilium_required                      = false
  linkerd_required                     = false

  extra_tolerations = [
    {
      effect   = "NoSchedule"
      key      = "node.kubernetes.io/not-ready"
      operator = "Exists"
    },
    {
      effect   = "NoExecute"
      key      = "node.kubernetes.io/not-ready"
      operator = "Exists"
    }
  ]
}

module "aws_pull_through" {
  source = "../aws_ecr_pull_through_cache_addresses"

  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util_destination" {
  source = "../kube_workload_utility"

  workload_name                        = "linkerd-destination"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_preferred                  = var.enhanced_ha_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_identity" {
  source = "../kube_workload_utility"

  workload_name                        = "linkerd-identity"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_preferred                  = var.enhanced_ha_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_proxy_injector" {
  source = "../kube_workload_utility"

  workload_name                        = "linkerd-proxy-injector"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_preferred                  = var.enhanced_ha_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_proxy" {
  source = "../kube_workload_utility"

  workload_name               = "linkerd-proxy"
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  extra_labels                = data.pf_kube_labels.labels.labels

}

module "util_viz" {
  source = "../kube_workload_utility"

  workload_name               = "linkerd-viz"
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  extra_labels                = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  extra_labels = var.monitoring_enabled ? { "linkerd.io/extension" = "viz" } : {}
}


/***************************************
* Linkerd Certs
***************************************/

///////////////////////////////////////////
// Step 1: Create a CA inside of the linkerd
// namespace that will be used to issue identity certificates
// (we just generate the cert and give it to linkerd so it
// can do the generation)
///////////////////////////////////////////

module "linkerd_identity_issuer" {
  source = "../kube_internal_cert"

  secret_name = local.linkerd_identity_issuer
  common_name = "identity.linkerd.cluster.local"
  namespace   = local.namespace
  is_ca       = true
  usages = [
    "cert sign",
    "crl sign",
    "server auth",
    "client auth"
  ]
  duration     = "2160h0m0s"
  renew_before = "1680h0m0s"
}

///////////////////////////////////////////
// Step 2: Setup a mechanism to copy
// the CA cert data of the root Vault CA into all namespaces
// so that linkerd can use them to validate the
// certificates
///////////////////////////////////////////

# Make sure this CA data is available in all namespaces for mTLS
resource "kubernetes_config_map" "ca_bundle" {
  metadata {
    name      = local.linkerd_root_ca_secret
    labels    = module.util_identity.labels
    namespace = local.namespace
  }
  data = {
    "ca-bundle.crt" = var.vault_ca_crt
  }
}

module "sync_ca_bundle" {
  source = "../kube_sync_config_map"

  config_map_name      = kubernetes_config_map.ca_bundle.metadata[0].name
  config_map_namespace = kubernetes_config_map.ca_bundle.metadata[0].namespace
}

///////////////////////////////////////////
// Step 3: Setup the webhook certs
// based on these docs for automatic rotation:
// https://linkerd.io/2.13/tasks/automatically-rotating-webhook-tls-credentials/
///////////////////////////////////////////

module "linkerd_policy_validator" {
  source = "../kube_internal_cert"

  secret_name          = local.linkerd_policy_validator_webhook_secret
  service_names        = ["linkerd-policy-validator"]
  namespace            = local.namespace
  private_key_encoding = "PKCS8" // It must be this encoding
  duration             = "2160h0m0s"
  renew_before         = "1680h0m0s"
}



module "linkerd_proxy_injector" {
  source = "../kube_internal_cert"

  secret_name   = local.linkerd_proxy_injector_webhook_secret
  service_names = ["linkerd-proxy-injector"]
  namespace     = local.namespace
  duration      = "2160h0m0s"
  renew_before  = "1680h0m0s"
}


module "linkerd_profile_validator" {
  source = "../kube_internal_cert"

  secret_name   = local.linkerd_profile_validator_webhook_secret
  service_names = ["linkerd-sp-validator"]
  namespace     = local.namespace
  duration      = "2160h0m0s"
  renew_before  = "1680h0m0s"
}



/***************************************
* Linkerd
***************************************/

resource "helm_release" "linkerd_crds" {
  namespace       = local.namespace
  name            = "linkerd-crds"
  repository      = "https://helm.linkerd.io/edge"
  chart           = "linkerd-crds"
  version         = var.linkerd_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5
}

resource "helm_release" "linkerd_cni" {
  namespace       = local.namespace
  name            = "linkerd-cni"
  repository      = "https://helm.linkerd.io/edge"
  chart           = "linkerd2-cni"
  version         = var.linkerd_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      podLabels         = module.util_cni.labels
      commonLabels      = module.util_cni.labels
      logLevel          = var.log_level
      priorityClassName = "system-node-critical"

      resources = {
        memory = {
          request = "100Mi"
          limit   = "110Mi"
        }
        cpu = {
          request = "10m"
        }
      }
      tolerations = module.util_cni.tolerations
    })
  ]
}

resource "kubernetes_cluster_role" "linkerd_cni_node_patcher" {
  metadata {
    name   = "linkerd-cni-node-patcher"
    labels = data.pf_kube_labels.labels.labels
  }
  rule {
    api_groups = [""]
    resources  = ["nodes"]
    verbs      = ["get", "list", "watch", "patch", "update"]
  }
}

resource "kubernetes_cluster_role_binding" "linkerd_cni_node_patcher" {
  metadata {
    name   = "linkerd-cni-node-patcher"
    labels = data.pf_kube_labels.labels.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = "linkerd-cni"
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.linkerd_cni_node_patcher.metadata[0].name
  }

  depends_on = [helm_release.linkerd_cni]
}

// hostNetwork=true is required so that the linkerd CNI can be installed
// concurrently with the cilium CNI; the helm chart does not provide a way
// to expose this
resource "kubectl_manifest" "linkerd_cni_policy" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "linkerd-cni"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      rules = [
        {
          name = "update-pods"
          match = {
            any = [
              {
                resources = {
                  kinds      = ["Pod"]
                  operations = ["CREATE"]
                  names      = ["linkerd-cni-*"]
                }
              }
            ]
          }
          mutate = {
            patchStrategicMerge = {
              spec = {
                hostNetwork = true # Allows the pod to launch without waiting for cilium

                # Removes the linkerd init taint
                containers = [
                  {
                    name = "remove-taint"

                    # module.aws_pull_through is required as this isn't guaranteed to go through the global pod mutator
                    image = "${module.aws_pull_through.docker_hub_registry}/bitnami/kubectl:${module.constants.kube_version}"
                    command = [
                      "bash",
                      "-c",
                      "sleep 10; while true; do kubectl taint nodes \\$(NODE_NAME) panfactum.com/linkerd-not-ready- || true; sleep 300; done"
                    ]
                    securityContext = {
                      runAsGroup               = 1000
                      runAsUser                = 1000
                      allowPrivilegeEscalation = false
                      readOnlyRootFilesystem   = true
                      privileged               = false
                      capabilities = {
                        drop = ["ALL"]
                      }
                    }

                    resources = {
                      requests = {
                        cpu    = "2m"
                        memory = "4Mi"
                      }
                      limits = {
                        memory = "20Mi"
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      ]
    }
  })

  force_conflicts   = true
  server_side_apply = true

  depends_on = [helm_release.linkerd_cni]
}


resource "helm_release" "linkerd" {
  namespace       = local.namespace
  name            = "linkerd-control-plane"
  repository      = "https://helm.linkerd.io/edge"
  chart           = "linkerd-control-plane"
  version         = var.linkerd_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      controllerLogLevel        = var.log_level
      controllerLogFormat       = "json"
      controllerReplicas        = 2
      enablePodAntiAffinity     = true  # This should always be enabled as we really need to avoid having the service mesh go down
      enablePodDisruptionBudget = false # We do this below

      # We never need to surge this
      deploymentStrategy = {
        rollingUpdate = {
          maxUnavailable = 1
          maxSurge       = 0
        }
      }

      # Was never able to get the CNI to work.
      # Given the additional downside of this breaking init containers,
      # it's probably for the best to leave it disabled
      cniEnabled = true

      identity = {
        externalCA = true
        issuer = {
          scheme = "kubernetes.io/tls"
        }
      }
      identityResources = {
        memory = {
          limit = "500Mi"
        }
      }

      proxy = {
        nativeSidecar       = true
        logFormat           = "json"
        logLevel            = "${var.log_level},linkerd=${var.log_level},linkerd2_proxy=${var.log_level}"
        shutdownGracePeriod = "29s" // The default of 120s exceeds the k8s default of 30s which causes problems
        resources = {

          // Native sidecars are not autoscaled due to this issue
          // https://github.com/kubernetes/autoscaler/issues/6691
          // so we set the request low and the limit high as
          // the majority of proxies are low resource consumption
          memory = {
            request = "10Mi"
            limit   = "200Mi"
          }
        }

        opaquePorts = "25,587,3306,4222,6222,4444,5432,6379,9300,11211"
      }

      policyController = {
        logLevel = var.log_level
        resources = {
          memory = {
            // If this does down, networking in the cluster will break causing a cascading failure
            // so we should give a 2.5x memory headroom to deal with memory spikes
            request = "200Mi"
            limit   = "500Mi"
          }
        }
      }

      podLabels = merge(
        module.util_proxy.labels,
        {
          customizationHash = md5(join("", [
            for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
          ]))
        }
      )

      // These pods must be running in order to prevent cascading cluster failures
      priorityClassName = "system-node-critical"

      tolerations = module.util_identity.tolerations

      policyValidator = {
        externalSecret = true
        injectCaFrom   = "${local.namespace}/${local.linkerd_policy_validator_webhook_secret}"
      }
      spValidatorResources = {
        memory = {
          // If this does down, networking in the cluster will break causing a cascading failure
          // so we should give a 2.5x memory headroom to deal with memory spikes
          request = "200Mi"
          limit   = "400Mi"
        }
      }

      profileValidator = {
        externalSecret = true
        injectCaFrom   = "${local.namespace}/${local.linkerd_profile_validator_webhook_secret}"
      }
      destinationResources = {
        memory = {
          // If this does down, networking in the cluster will break causing a cascading failure
          // so we should give a 2x memory headroom to deal with memory spikes
          request = "200Mi"
          limit   = "400Mi"
        }
      }

      proxyInjector = {

        externalSecret = true
        injectCaFrom   = "${local.namespace}/${local.linkerd_proxy_injector_webhook_secret}"

        // We have to manually put this in here
        // b/c for some reason the default helm chart values disallow the sidecar proxy
        // for cert-manager
        namespaceSelector = {
          matchExpressions = [{
            key      = "config.linkerd.io/admission-webhooks"
            operator = "NotIn"
            values   = ["disabled"]
          }]
        }
      }
      proxyInjectorResources = {
        memory = {
          // If this does down, networking in the cluster will break causing a cascading failure
          // so we should give a 2.5x memory headroom to deal with memory spikes
          request = "200Mi"
          limit   = "400Mi"
        }
      }


      proxyInit = {
        logFormat = "json"
        logLevel  = var.log_level

        // Be default, the init container
        // has way too many resources and ends up
        // utilizing all of the resource request allocations
        // on each node, so we lower them significantly
        // The values selected are the lowest allowable
        // values for VPA measurements; no container
        // on the cluster will EVER get lower values,
        // so no point in going any lower
        resources = {
          cpu = {
            request = "10m"
          }
          memory = {
            request = "10Mi"
            limit   = "10Mi"
          }
        }
      }

      prometheusUrl = var.monitoring_enabled ? "http://thanos-query-frontend.monitoring.svc.cluster.local:9090" : null
      podMonitor = {
        enabled        = var.monitoring_enabled
        scrapeInterval = "60s"
        proxy = {
          enabled = true
        }
        controller = {
          enabled = true
        }
      }

    })
  ]

  // (1) The default pod monitor scrapes all pods, even
  // ones without the proxy which generates prometheus errors
  // (2) There is no way to set pod labels for each individual controller
  // (3) There is no way to customize affinities
  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
    args = [
      yamlencode({
        apiVersion = "apps/v1"
        kind       = "Deployment"
        metadata = {
          name = "linkerd-destination"
        }
        spec = {
          template = {
            metadata = {
              labels = module.util_destination.labels
            }
            spec = {
              schedulerName             = var.panfactum_scheduler_enabled ? module.constants.panfactum_scheduler_name : "default-scheduler"
              affinity                  = module.util_destination.affinity
              topologySpreadConstraints = module.util_destination.topology_spread_constraints
              tolerations               = module.util_destination.tolerations
            }
          }
        }
      }),
      yamlencode({
        apiVersion = "apps/v1"
        kind       = "Deployment"
        metadata = {
          name = "linkerd-identity"
        }
        spec = {
          template = {
            metadata = {
              labels = module.util_identity.labels
            }
            spec = {
              schedulerName             = var.panfactum_scheduler_enabled ? module.constants.panfactum_scheduler_name : "default-scheduler"
              affinity                  = module.util_identity.affinity
              topologySpreadConstraints = module.util_identity.topology_spread_constraints
              tolerations               = module.util_identity.tolerations
            }
          }
        }
      }),
      yamlencode({
        apiVersion = "apps/v1"
        kind       = "Deployment"
        metadata = {
          name = "linkerd-proxy-injector"
        }
        spec = {
          template = {
            metadata = {
              labels = module.util_proxy_injector.labels
            }
            spec = {
              schedulerName             = var.panfactum_scheduler_enabled ? module.constants.panfactum_scheduler_name : "default-scheduler"
              affinity                  = module.util_proxy_injector.affinity
              topologySpreadConstraints = module.util_proxy_injector.topology_spread_constraints
              tolerations               = module.util_proxy_injector.tolerations
            }
          }
        }
      })
    ]
  }

  depends_on = [
    helm_release.linkerd_crds,
    kubernetes_config_map.ca_bundle,
    module.linkerd_policy_validator,
    module.linkerd_proxy_injector,
    module.linkerd_identity_issuer,
    module.linkerd_profile_validator,
    helm_release.linkerd_cni
  ]
}

/***************************************
* Image Cache
***************************************/

module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [

    // This ensures that the proxy image is preloaded onto each node.
    // This is more for improving node startup time than anything else and saves
    // around 4-5 seconds off the first container launch
    {
      registry    = "cr.l5d.io"
      repository  = "linkerd/proxy"
      tag         = local.linkerd_image_tag
      pin_enabled = false
    },

    // Allows the operator components to failover faster
    {
      registry   = "cr.l5d.io"
      repository = "linkerd/controller"
      tag        = local.linkerd_image_tag
    },
    {
      registry   = "cr.l5d.io"
      repository = "linkerd/policy-controller"
      tag        = local.linkerd_image_tag
    }
  ]
}


/***************************************
* Linkerd Policies
***************************************/

resource "kubectl_manifest" "kyverno_policies" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "linkerd-rules"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      rules = [

        // Linkerd will try to inject a "validator" init container to all pods
        // that ensures that the CNI is installed. However, we do not do this check
        // as it adds too long to container startup time so we use taints to accomplish this check instead.
        {
          name = "remove-network-validator"
          match = {
            any = [
              {
                resources = {
                  kinds = ["Pod"]
                }
              }
            ]
          }
          preconditions = {
            all = [
              {
                key      = "{{ request.object.spec.initContainers[] || `[]` | length(@) }}"
                operator = "GreaterThanOrEquals"
                value    = 1
              },
              {
                key      = "{{ request.object.status.phase || 'Pending' }}"
                operator = "AnyIn"
                value    = "Pending"
              }
            ]
          }
          mutate = {
            foreach = [
              {
                list = "request.object.spec.initContainers"
                patchesJson6902 = yamlencode([
                  {
                    path = "/spec/initContainers/{{elementIndex}}"
                    op   = "remove"
                  }
                ])
                preconditions = {
                  all = [
                    {
                      key      = "{{ element.name }}"
                      operator = "AnyIn"
                      value    = "linkerd-network-validator"
                    }
                  ]
                }
              }
            ]
          }
        },

        // This removes the linkerd taint on each node which
        // indicates that the linkerd CNI has been installed
        // While this is duplicative with the remove-taint container defined
        // above, this extra redundancy ensures we do not end up in a deadlocked
        // situation
        {
          name = "remove-linkerd-taint"
          match = {
            any = [
              {
                resources = {
                  kinds = ["Pod"]
                  names = ["linkerd-cni-*"]
                }
              }
            ]
          }
          preconditions = {
            all = [
              {
                key      = "{{ request.object.status.phase || 'Pending' }}"
                operator = "Equals"
                value    = "Running"
              }
            ]
          }
          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [
              {
                apiVersion = "v1"
                kind       = "Node"
                name       = "{{ request.object.spec.nodeName }}"
              }
            ]
            foreach = [
              {
                list = "target.spec.taints"
                preconditions = {
                  all = [
                    {
                      key      = "{{ element.key }}"
                      operator = "AnyIn"
                      value    = "panfactum.com/linkerd-not-ready"
                    }
                  ]
                }
                patchesJson6902 = yamlencode([
                  {
                    path = "/spec/taints/{{elementIndex}}"
                    op   = "remove"
                  }
                ])
              }
            ]
          }
        },

        // The sidecar proxy should always shutdown prior to the pod terminationGracePeriodSeconds elapsing;
        // otherwise, the pod will look "failed" to controllers like Argo. This can occur if the main pod
        // has a TCP connection leak that would otherwise be harmless
        {
          name = "set-linkerd-shutdown-grace-period"
          match = {
            any = [
              {
                resources = {
                  kinds      = ["Pod"]
                  operations = ["CREATE"]
                }
              }
            ]
          }
          mutate = {
            patchStrategicMerge = {
              metadata = {
                annotations = {
                  "+(config.linkerd.io/shutdown-grace-period)" = "{{ max([subtract(`{{ request.object.spec.terminationGracePeriodSeconds || `30` }}`,`1`), `0`]) }}s"
                }
              }
            }
          }
        }
      ]

      webhookConfiguration = {
        failurePolicy = "Ignore"
      }
    }
  })

  force_conflicts   = true
  server_side_apply = true
}

/***************************************
* Linkerd Viz
***************************************/

resource "helm_release" "viz" {
  count           = var.monitoring_enabled ? 1 : 0
  namespace       = local.namespace
  name            = "linkerd-viz"
  repository      = "https://helm.linkerd.io/edge"
  chart           = "linkerd-viz"
  version         = var.linkerd_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      defaultLogFormat      = "json"
      defaultLogLevel       = var.log_level
      tolerations           = module.util_viz.tolerations
      enablePodAntiAffinity = var.enhanced_ha_enabled
      podLabels             = module.util_viz.labels
      commonLabels          = module.util_viz.labels

      prometheusUrl = "http://thanos-query-frontend.monitoring.svc.cluster.local:9090"
      prometheus = {
        enabled = false // We use our external prometheus
      }

      // This Job adds security controls to the linkerd namespace that breaks CNI installation so we disable it
      createNamespaceMetadataJob = false

      metricsAPI = {
        replicas = 1
      }

      tap = {
        replicas = 2
      }

      tapInjector = {
        replicas = 2
      }

      dashboard = {
        replicas = 2
      }

    })
  ]


  # Needed b/c tolerations are not set appropriately on the metrics-api
  postrender {
    binary_path = "${path.module}/kustomize_viz/kustomize.sh"
  }

  depends_on = [
    helm_release.linkerd
  ]
}

/***************************************
* Autoscaling
***************************************/

resource "kubectl_manifest" "vpa_cni" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-cni"
      namespace = local.namespace
      labels    = module.util_cni.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "remove-taint"
          mode          = "Off"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "linkerd-cni"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.linkerd_cni]
}

resource "kubectl_manifest" "pdb_cni" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "linkerd-cni"
      namespace = local.namespace
      labels    = module.util_cni.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_cni.match_labels
      }
      minAvailable = 0
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.linkerd_cni]
}

resource "kubectl_manifest" "vpa_identity" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-identity"
      namespace = local.namespace
      labels    = module.util_identity.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "linkerd-identity"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.linkerd]
}

resource "kubectl_manifest" "pdb_identity" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "linkerd-identity"
      namespace = local.namespace
      labels    = module.util_identity.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_identity.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.linkerd]
}

resource "kubectl_manifest" "vpa_destination" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-destination"
      namespace = local.namespace
      labels    = module.util_destination.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "linkerd-destination"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.linkerd]
}


resource "kubectl_manifest" "pdb_destination" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "linkerd-destination"
      namespace = local.namespace
      labels    = module.util_destination.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_destination.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.linkerd]
}

resource "kubectl_manifest" "vpa_proxy_injectory" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-proxy-injector"
      namespace = local.namespace
      labels    = module.util_proxy_injector.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "linkerd-proxy-injector"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.linkerd]
}

resource "kubectl_manifest" "pdb_proxy_injector" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "linkerd-proxy-injector"
      namespace = local.namespace
      labels    = module.util_proxy_injector.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_proxy_injector.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.linkerd]
}

resource "kubectl_manifest" "vpa_metrics_api" {
  count = var.vpa_enabled && var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-metrics-api"
      namespace = local.namespace
      labels    = module.util_viz.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "metrics-api"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.viz]
}

resource "kubectl_manifest" "pdb_metrics_api" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "linkerd-metrics-api"
      namespace = local.namespace
      labels    = module.util_viz.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = {
          "linkerd.io/extension"        = "viz"
          "linkerd.io/proxy-deployment" = "metrics-api"
        }
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.viz]
}

resource "kubectl_manifest" "vpa_tap_injector" {
  count = var.vpa_enabled && var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-tap-injector"
      namespace = local.namespace
      labels    = module.util_viz.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "tap-injector"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.viz]
}

resource "kubectl_manifest" "pdb_tap_injector" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "linkerd-tap-injector"
      namespace = local.namespace
      labels    = module.util_viz.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = {
          "linkerd.io/extension"        = "viz"
          "linkerd.io/proxy-deployment" = "tap-injector"
        }
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.viz]
}

resource "kubectl_manifest" "vpa_web" {
  count = var.vpa_enabled && var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-web"
      namespace = local.namespace
      labels    = module.util_viz.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "web"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.viz]
}


resource "kubectl_manifest" "pdb_web" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "linkerd-web"
      namespace = local.namespace
      labels    = module.util_viz.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = {
          "linkerd.io/extension"        = "viz"
          "linkerd.io/proxy-deployment" = "web"
        }
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.viz]
}


resource "kubectl_manifest" "vpa_tap" {
  count = var.vpa_enabled && var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-tap"
      namespace = local.namespace
      labels    = module.util_viz.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "tap"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.viz]
}

resource "kubectl_manifest" "pdb_tap" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "linkerd-tap"
      namespace = local.namespace
      labels    = module.util_viz.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = {
          "linkerd.io/extension"        = "viz"
          "linkerd.io/proxy-deployment" = "tap"
        }
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.viz]
}
