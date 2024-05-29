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
      version = "5.39.1"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

locals {
  name      = "cilium"
  namespace = module.namespace.namespace
}

data "aws_region" "region" {}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "base_labels" {
  source = "../kube_labels"

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

module "operator_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(module.base_labels.kube_labels, { service = "operator" })
}

module "agent_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(module.base_labels.kube_labels, { service = "agent" })
}

module "constants" {
  source = "../constants"

  matching_labels = module.operator_labels.kube_labels

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(module.base_labels.kube_labels, { service = "operator" })
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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

  values = [
    yamlencode({
      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/cilium/cilium"
      }

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

      podLabels = module.base_labels.kube_labels

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
          memory = "300Mi" // Needs to be a bit higher before the VPA is enabled
        }
        limits = {
          memory = "390Mi"
        }
      }

      tolerations = concat(
        [
          {
            key      = module.constants.cilium_taint.key
            operator = "Exists"
            effect   = module.constants.cilium_taint.effect
          },
          {
            key      = "node.kubernetes.io/not-ready"
            operator = "Exists"
          },
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
        module.constants.burstable_node_toleration_helm
      )

      prometheus = {
        enabled = var.monitoring_enabled
        serviceMonitor = {
          enabled  = var.monitoring_enabled
          jobLabel = "cilium-agent"
          labels   = module.agent_labels.kube_labels
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
        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/cilium/operator"
        }
        replicas = 2
        updateStrategy = {
          type          = "Recreate"
          rollingUpdate = null
        }
        tolerations = concat([

          // This is needed b/c the cilium agents on each node need the operator
          // to be running in order for them to remove this taint
          {
            key      = module.constants.cilium_taint.key
            operator = "Exists"
            effect   = module.constants.cilium_taint.effect
          }
          ],
          module.constants.burstable_node_toleration_helm
        )

        podLabels = module.operator_labels.kube_labels

        affinity = merge(
          module.constants.controller_node_affinity_helm,
          module.constants.pod_anti_affinity_instance_type_helm
        )

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
            labels   = module.operator_labels.kube_labels
          }
        }
      }
    })
  ]
}

resource "kubernetes_manifest" "vpa_operator" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "cilium-operator"
      namespace = local.namespace
      labels    = module.operator_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "cilium-operator"
      }
    }
  }
  depends_on = [helm_release.cilium]
}

resource "kubernetes_manifest" "vpa_node" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "cilium-nodes"
      namespace = local.namespace
      labels    = module.agent_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "cilium"
      }
    }
  }
  depends_on = [helm_release.cilium]
}

resource "kubernetes_manifest" "pdb_operator" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.name}-pdb-operator"
      namespace = local.namespace
      labels    = module.operator_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = module.operator_labels.kube_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cilium]
}
