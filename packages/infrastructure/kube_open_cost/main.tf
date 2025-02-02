terraform {
  required_providers {
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
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  namespace    = module.namespace.namespace
  cluster_name = data.pf_metadata.metadata.kube_cluster_name
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "pf_kube_labels" "labels" {
  module = "kube_open_cost"
}
data "pf_metadata" "metadata" {}

module "util" {
  source = "../kube_workload_utility"

  workload_name                        = "open-cost"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false // single copy
  az_spread_preferred                  = false // single copy
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_network_cost" {
  source = "../kube_workload_utility"

  workload_name                        = "network-cost"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = false
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false // ds
  az_spread_preferred                  = false // ds
  extra_labels                         = data.pf_kube_labels.labels.labels

}


module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = "open-cost"
}

/***************************************
* Spot Data Feed
***************************************/


data "aws_iam_policy_document" "spot_data" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:HeadObject",
    ]
    resources = ["${var.spot_data_feed_bucket_arn}/*"]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:HeadBucket",
      "s3:ListAllMyBuckets"
    ]
    resources = [var.spot_data_feed_bucket_arn]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:GetBucketLocation"
    ]
    resources = ["arn:aws:s3:::*"]
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.open_cost.metadata[0].name
  service_account_namespace = local.namespace
  iam_policy_json           = data.aws_iam_policy_document.spot_data.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}

/***************************************
* OpenCost
***************************************/

resource "kubernetes_service_account" "open_cost" {
  metadata {
    name      = "open-cost"
    namespace = local.namespace
    labels    = module.util.labels
  }
}

resource "helm_release" "open_cost" {
  namespace       = local.namespace
  name            = "open-cost"
  repository      = "https://opencost.github.io/opencost-helm-chart"
  chart           = "opencost"
  version         = var.open_cost_helm_version
  recreate_pods   = false
  atomic          = true
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "open-cost"
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.open_cost.metadata[0].name
      }
      podLabels = merge(
        module.util.labels,
        {
          customizationHash = md5(join("", [
            for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
          ]))
        }
      )
      opencost = {
        customPricing = {
          enabled  = true
          provider = "aws"
          costModel = {
            zoneNetworkEgress     = "0.02"
            regionNetworkEgress   = "0.02"
            internetNetworkEgress = "0.09"
            spotLabel             = "karpenter.sh/capacity-type"
            spotLabelValue        = "spot"
            projectID             = data.aws_caller_identity.current.account_id
            awsSpotDataBucket     = var.spot_data_feed_bucket
            awsSpotDataRegion     = var.spot_data_feed_bucket_region
          }
        }
        cloudCost = {
          enabled = false
        }

        exporter = {
          defaultClusterId = local.cluster_name
          extraEnv = {
            EMIT_KSM_V1_METRICS      = false
            EMIT_KSM_V1_METRICS_ONLY = true
          }
          resources = {
            requests = {
              cpu    = "100m"
              memory = "200Mi"
            }
            limits = {
              memory = "260Mi"
            }
          }
        }
        ui = {
          enabled = false // We use grafana
        }
        metrics = {
          serviceMonitor = {
            enabled        = true
            scrapeInterval = "60s"
            namespace      = local.namespace
            honorLabels    = true
          }
        }
        prometheus = {
          internal = {
            enabled       = true
            namespaceName = "monitoring"
            serviceName   = "thanos-query-frontend"
            port          = 9090
          }
        }

        priorityClassName = module.constants.cluster_important_priority_class_name
        affinity          = module.util.affinity
        tolerations       = module.util.tolerations

        service = {
          labels = module.util.labels
        }
      }
    })
  ]
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "open-cost"
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "open-cost"
          minAllowed = {
            memory = "150Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resource          = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "open-cost"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.open_cost]
}

/***************************************
* Network Cost
***************************************/

resource "kubernetes_service_account" "network_cost" {
  metadata {
    name      = "network-cost"
    labels    = module.util_network_cost.labels
    namespace = local.namespace
  }
}

resource "kubernetes_cluster_role" "network_cost" {
  metadata {
    name   = "network-cost"
    labels = module.util_network_cost.labels
  }
  rule {
    api_groups = [""]
    resources = [
      "configmaps",
      "nodes",
      "pods",
      "events",
      "services",
      "resourcequotas",
      "replicationcontrollers",
      "limitranges",
      "persistentvolumeclaims",
      "persistentvolumes",
      "namespaces",
      "endpoints"
    ]
    verbs = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["apps"]
    resources = [
      "statefulsets",
      "deployments",
      "daemonsets",
      "replicasets"
    ]
    verbs = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["batch"]
    resources = [
      "jobs",
      "cronjobs"
    ]
    verbs = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["autoscaling"]
    resources  = ["horizontalpodautoscalers"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["policy"]
    resources  = ["poddisruptionbudgets"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["storage.k8s.io"]
    resources  = ["storageclasses"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["events.k8s.io"]
    resources  = ["events"]
    verbs      = ["get", "list", "watch"]
  }
}

resource "kubernetes_cluster_role_binding" "network_cost" {
  metadata {
    name   = "network-cost"
    labels = module.util_network_cost.labels
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.network_cost.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.network_cost.metadata[0].name
    namespace = local.namespace
  }
}

# We consider s3 IPs to be "in-zone" b/c we use the
# s3 endpoint
data "aws_ip_ranges" "s3" {
  regions  = [data.aws_region.current.name]
  services = ["s3"]
}

resource "kubernetes_config_map" "network_cost" {
  metadata {
    name      = "network-cost-config"
    labels    = module.util_network_cost.labels
    namespace = local.namespace
  }
  data = {
    "config.yaml" = yamlencode({
      destinations = {
        in-zone = concat([
          "127.0.0.0/8",
          "169.254.0.0/16",
          "172.16.0.0/12",
          "192.168.0.0/16"
        ], data.aws_ip_ranges.s3.cidr_blocks)
        direct-classification = [
          {
            region = "us-east-2"
            zone   = "us-east-2a"
            ips = [
              "10.0.16.0/20",
              "10.0.64.0/18"
            ]
          },
          {
            region = "us-east-2"
            zone   = "us-east-2b",
            ips = [
              "10.0.58.0/20",
              "10.0.128.0/18"
            ]
          },
          {
            region = "us-east-2"
            zone   = "us-east-2c"
            ips = [
              "10.0.58.0/20",
              "10.0.192.0/18"
            ]
          }
        ]
      }
      services = {
        amazon-web-services   = true
        google-cloud-services = false
        azure-cloud-services  = false
      }
    })
  }
}

resource "kubectl_manifest" "network_cost" {
  yaml_body = yamlencode({
    apiVersion = "apps/v1"
    kind       = "DaemonSet"
    metadata = {
      name      = "network-cost"
      namespace = local.namespace
      labels    = module.util_network_cost.labels
    }
    spec = {
      updateStrategy = {
        type = "RollingUpdate"
      }
      selector = {
        matchLabels = module.util_network_cost.match_labels
      }
      template = {
        metadata = {
          labels = module.util_network_cost.labels
        }
        spec = {
          hostNetwork = true

          serviceAccountName = kubernetes_service_account.network_cost.metadata[0].name
          priorityClassName  = module.constants.cluster_important_priority_class_name
          tolerations        = module.util_network_cost.tolerations
          affinity           = module.util_network_cost.affinity
          containers = [{
            name  = "network-cost"
            image = "public.ecr.aws/kubecost/kubecost-network-costs:v0.17.3"
            securityContext = {
              privileged = true
            }
            env = [
              {
                name = "NODE_NAME"
                valueFrom = {
                  fieldRef = {
                    fieldPath = "spec.nodeName"
                  }
                }
              },
              {
                name  = "HOST_PORT"
                value = "3001"
              }
            ]
            ports = [
              {
                name          = "http-server"
                containerPort = 3001
                hostPort      = 3001
              }
            ]
            volumeMounts = [
              {
                name      = "nf-conntrack"
                mountPath = "/net"
              },
              {
                name      = "netfilter"
                mountPath = "/netfilter"
              },
              {
                name      = kubernetes_config_map.network_cost.metadata[0].name
                mountPath = "/network-costs/config"
              }
            ]
            resources = {
              requests = {
                cpu    = "50m"
                memory = "100Mi"
              }
              limits = {
                memory = "130Mi"
              }
            }
          }]
          volumes = [
            {
              name = kubernetes_config_map.network_cost.metadata[0].name
              configMap = {
                name = kubernetes_config_map.network_cost.metadata[0].name
              }
            },
            {
              name = "nf-conntrack"
              hostPath = {
                path = "/proc/net"
              }
            },
            {
              name = "netfilter"
              hostPath = {
                path = "/proc/sys/net/netfilter"
              }
            },
          ]
        }
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
}

resource "kubectl_manifest" "network_cost_pod_monitor" {
  yaml_body = yamlencode({
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PodMonitor"
    metadata = {
      name      = "network-cost"
      namespace = local.namespace
      labels    = module.util_network_cost.labels
    }
    spec = {
      podMetricsEndpoints = [
        {
          port          = "http-server"
          honorLabels   = true
          interval      = "1m"
          scrapeTimeout = "10s"
          path          = "/metrics"
          scheme        = "http"
        }
      ]
      namespaceSelector = {
        matchNames = [local.namespace]
      }
      selector = {
        matchLabels = module.util_network_cost.match_labels
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [kubectl_manifest.network_cost]
}

resource "kubectl_manifest" "vpa_network_cost" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "network-cost"
      namespace = local.namespace
      labels    = module.util_network_cost.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "network-cost"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [kubectl_manifest.network_cost]
}
