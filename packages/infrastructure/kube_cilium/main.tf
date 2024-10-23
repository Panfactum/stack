// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.70.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  name      = "cilium"
  namespace = module.namespace.namespace
}

data "aws_region" "region" {}

data "pf_kube_labels" "labels" {
  module = "kube_alloy"
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "cilium-operator"
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_preferred                  = var.enhanced_ha_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_agent" {
  source = "../kube_workload_utility"

  workload_name               = "cilium-agent"
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled
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
}

/***************************************
* AWS Permissions
***************************************/

data "aws_iam_policy_document" "cilium" {
  statement {
    effect = "Allow"
    actions = [
      "ec2:DeleteNetworkInterface",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeSubnets",
      "ec2:DescribeVpcs",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceTypes",
      "ec2:UnassignPrivateIpAddresses",
      "ec2:CreateNetworkInterface",
      "ec2:AttachNetworkInterface",
      "ec2:ModifyNetworkInterfaceAttribute",
      "ec2:AssignPrivateIpAddresses",
      "ec2:CreateTags",
      "ec2:DescribeTags"
    ]
    resources = ["*"]
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"


  annotate_service_account  = false // The helm chart creates the service account
  service_account           = "cilium-operator"
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.cilium.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}

resource "kubernetes_annotations" "service_account" {
  api_version = "v1"
  kind        = "ServiceAccount"
  metadata {
    name      = "cilium-operator"
    namespace = local.namespace
  }
  annotations = {
    "eks.amazonaws.com/role-arn" = module.aws_permissions.role_arn
  }
  depends_on = [helm_release.cilium]
}


/***************************************
* Cilium
***************************************/

resource "helm_release" "cilium" {
  namespace       = local.namespace
  name            = "cilium"
  repository      = "https://helm.cilium.io/"
  chart           = "cilium"
  version         = var.cilium_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = false // Don't wait b/c this won't work on initial setup in EKS due to the existing CNIs on the nodes
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      eni = {
        enabled = true

        // Required to ensure that all IPs get assigned to a single
        // ENI; otherwise, traffic will get dropped
        // https://github.com/cilium/cilium/issues/19250
        awsEnablePrefixDelegation = true
        awsReleaseExcessIPs       = true
      }
      ipam = {
        mode    = "eni"
        iamRole = module.aws_permissions.role_arn
      }
      egressMasqueradeInterfaces = "eth0"
      routingMode                = "native"

      podLabels = merge(
        module.util_agent.labels,
        {
          customizationHash = md5(join("", [
            for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
          ]))
        }
      )

      policyEnforcementMode = "default"

      // The docs don't state this, but the EKS API IP address
      // shifts so you MUST use the internal EKS API DNS name
      // in order for this to continue to work
      kubeProxyReplacement = true
      k8sServiceHost       = trimprefix(var.eks_cluster_url, "https://")
      k8sServicePort       = 443

      // Enhanced load balancing capabilities
      loadBalancer = {
        serviceTopology = true
        algorithm       = "maglev"
      }

      logOptions = {
        format = "json"
        level  = var.log_level
      }

      // Used to facilitate the proper scaling in the cluster autoscaler
      agentNotReadyTaintKey = module.constants.cilium_taint.key

      // Required for Linkerd to work properly
      // See https://linkerd.io/2.13/reference/cluster-configuration/#cilium
      socketLB = {
        hostNamespaceOnly = true
      }

      resources = {
        requests = {
          memory = "400Mi" // Needs to be a bit higher before the VPA is enabled
        }
        // Do not set a limit b/c needs a burst of memory when starting up which is dependent on node size
        // and if the agent doesn't initialize successfully the node will be perpetually stuck in
        // and initializing phase. This will cause Karpenter to never de-provision it and essentially
        // result in a resource leak.
        limits = {}
      }

      tolerations = concat(
        [
          // These are required b/c the agent is what removes the taint
          {
            key      = module.constants.cilium_taint.key
            operator = "Exists"
            effect   = module.constants.cilium_taint.effect
          },
          {
            key      = "node.kubernetes.io/not-ready"
            operator = "Exists"
            effect   = "NoSchedule"
          },

          // This is required b/c otherwise networking will break during node shutdown
          {
            key      = "karpenter.sh/disruption"
            operator = "Exists"
            effect   = "NoSchedule"
          },

          // These are required b/c networking should never be disabled, even under resource pressure
          {
            key      = "node.kubernetes.io/unreachable"
            operator = "Exists"
            effect   = "NoExecute"
          },
          {
            key      = "node.kubernetes.io/disk-pressure"
            operator = "Exists"
            effect   = "NoSchedule"
          },
          {
            key      = "node.kubernetes.io/memory-pressure"
            operator = "Exists"
            effect   = "NoSchedule"
          },
          {
            key      = "node.kubernetes.io/pid-pressure"
            operator = "Exists"
            effect   = "NoSchedule"
          }
        ],
        module.util_agent.tolerations
      )

      prometheus = {
        enabled = var.monitoring_enabled
        serviceMonitor = {
          enabled  = var.monitoring_enabled
          jobLabel = "cilium-agent"
          labels   = module.util_agent.labels
          interval = "60s"
        }
      }

      // TODO: Need to finish this up
      hubble = {
        enabled           = var.hubble_enabled
        enableOpenMetrics = false
        metrics = {
          enabled = [
            "dns:query;ignoreAAAA",
            "drop",
            "tcp",
            "flow",
            "port-distribution",
            "icmp",
            "httpV2:exemplars=true;labelsContext=source_ip,source_namespace,source_workload,destination_ip,destination_namespace,destination_workload,traffic_direction"
          ]

          serviceMonitor = {
            enabled  = var.hubble_enabled && var.monitoring_enabled
            interval = "60s"
            jobLabel = "hubble"
          }
        }

        tls = {
          enabled = false
        }

        relay = {
          enabled = var.hubble_enabled
        }

        ui = {
          enabled = var.hubble_enabled
        }
      }

      operator = {
        replicas = 2
        updateStrategy = {
          type          = "Recreate"
          rollingUpdate = null
        }
        tolerations = concat([
          // These are needed b/c the cilium agents on each node need the operator
          // to be running in order for them to remove this taint
          {
            key      = module.constants.cilium_taint.key
            operator = "Exists"
            effect   = module.constants.cilium_taint.effect
          },
          {
            key      = "node.kubernetes.io/not-ready"
            operator = "Exists"
            effect   = "NoSchedule"
          },
          ],
          module.util_controller.tolerations
        )

        podLabels = module.util_controller.labels

        affinity = module.util_controller.affinity

        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }

        // The operator is what assigns and updates node ENIs so this is
        // absolutely cluster critical
        priorityClassName = "system-cluster-critical"

        extraArgs = [
          "--cluster-name=${var.eks_cluster_name}"
        ]
        extraEnv = [
          { name : "AWS_ROLE_ARN", value = module.aws_permissions.role_arn },
          { name : "AWS_REGION", value = data.aws_region.region.name }
        ]

        prometheus = {
          serviceMonitor = {
            enabled  = var.monitoring_enabled
            interval = "60s"
            jobLabel = "cilium-operator"
            labels   = module.util_controller.labels
          }
        }
      }

      envoy = {
        enabled = false
      }

      gatewayAPI = {
        enabled = false
      }
    })
  ]
}

resource "kubectl_manifest" "vpa_operator" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "cilium-operator"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "cilium-operator"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cilium]
}

resource "kubectl_manifest" "vpa_node" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "cilium-nodes"
      namespace = local.namespace
      labels    = module.util_agent.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "cilium-agent"
          minAllowed = {
            # Sometimes on initial install, this goes too low and causes issues during the bootstrapping guide
            # so we set a floor
            memory = "200Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "cilium"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cilium]
}

resource "kubectl_manifest" "pdb_operator" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.name}-pdb-operator"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_controller.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cilium]
}
