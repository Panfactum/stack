// Live

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
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.70.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

data "aws_region" "main" {}
data "aws_caller_identity" "main" {}

locals {
  name      = "karpenter"
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_karpenter"
}

data "pf_aws_tags" "tags" {
  module = "kube_karpenter"
}

module "pull_through" {
  source = "../aws_ecr_pull_through_cache_addresses"

  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util" {
  source = "../kube_workload_utility"

  workload_name             = "karpenter"
  az_spread_preferred       = false
  controller_nodes_required = true
  burstable_nodes_enabled   = true
  extra_labels              = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name
}

/********************************************************************************************************************
* AWS Termination Queue Resources
*********************************************************************************************************************/

resource "aws_sqs_queue" "karpenter" {
  name_prefix               = "${var.cluster_name}-"
  message_retention_seconds = 300
  sqs_managed_sse_enabled   = true
  tags = merge(data.pf_aws_tags.tags.tags, {
    description = "Used by Karpenter to detect node termination events in advance"
  })
}

data "aws_iam_policy_document" "karpenter_sqs" {
  statement {
    sid       = "EC2InterruptionPolicy"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.karpenter.arn]
    principals {
      identifiers = ["events.amazonaws.com", "sqs.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_sqs_queue_policy" "karpenter" {
  queue_url = aws_sqs_queue.karpenter.name
  policy    = data.aws_iam_policy_document.karpenter_sqs.json
}

resource "aws_cloudwatch_event_rule" "scheduled_change" {
  name_prefix = "karpenter-scheduled-change-"
  event_pattern = jsonencode({
    source      = ["aws.health"]
    detail-type = ["AWS Health Event"]
  })
  tags = data.pf_aws_tags.tags.tags
}

resource "aws_cloudwatch_event_target" "scheduled_change" {
  target_id = "KarpenterInterruptionQueueTarget"
  arn       = aws_sqs_queue.karpenter.arn
  rule      = aws_cloudwatch_event_rule.scheduled_change.name
}

resource "aws_cloudwatch_event_rule" "spot_interruption" {
  name_prefix = "karpenter-spot-interruption-"
  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["EC2 Spot Instance Interruption Warning"]
  })
  tags = data.pf_aws_tags.tags.tags
}

resource "aws_cloudwatch_event_target" "spot_interruption" {
  target_id = "KarpenterInterruptionQueueTarget"
  arn       = aws_sqs_queue.karpenter.arn
  rule      = aws_cloudwatch_event_rule.spot_interruption.name
}

resource "aws_cloudwatch_event_rule" "rebalance" {
  name_prefix = "karpenter-spot-interruption-"
  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["EC2 Instance Rebalance Recommendation"]
  })
  tags = data.pf_aws_tags.tags.tags
}

resource "aws_cloudwatch_event_target" "rebalance" {
  target_id = "KarpenterInterruptionQueueTarget"
  arn       = aws_sqs_queue.karpenter.arn
  rule      = aws_cloudwatch_event_rule.rebalance.name
}

resource "aws_cloudwatch_event_rule" "instance_state_change" {
  name_prefix = "karpenter-spot-interruption-"
  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["EC2 Instance State-change Notification"]
  })
  tags = data.pf_aws_tags.tags.tags
}

resource "aws_cloudwatch_event_target" "instance_state_change" {
  target_id = "KarpenterInterruptionQueueTarget"
  arn       = aws_sqs_queue.karpenter.arn
  rule      = aws_cloudwatch_event_rule.instance_state_change.name
}

/********************************************************************************************************************
* Karpenter Controller Deployment
*********************************************************************************************************************/

// This is taken from their cloudformation template, not their website docs
// as the website docs permissions were incorrectly scoped
// See https://github.com/aws/karpenter/blob/main/website/content/en/v0.31/getting-started/getting-started-with-karpenter/cloudformation.yaml
data "aws_iam_policy_document" "karpenter" {
  statement {
    sid    = "AllowScopedEC2InstanceAccessActions"
    effect = "Allow"
    actions = [
      "ec2:RunInstances",
      "ec2:CreateFleet"
    ]
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}::image/*",
      "arn:aws:ec2:${data.aws_region.main.name}::snapshot/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:security-group/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:subnet/*"
    ]
  }
  statement {
    sid    = "AllowScopedEC2LaunchTemplateAccessActions"
    effect = "Allow"
    actions = [
      "ec2:RunInstances",
      "ec2:CreateFleet"
    ]
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}:*:launch-template/*"
    ]
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:ResourceTag/kubernetes.io/cluster/${var.cluster_name}"
    }
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:ResourceTag/karpenter.sh/nodepool"
    }
  }


  statement {
    sid    = "AllowScopedEC2InstanceActionsWithTags"
    effect = "Allow"
    actions = [
      "ec2:RunInstances",
      "ec2:CreateFleet",
      "ec2:CreateLaunchTemplate"
    ]
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}:*:fleet/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:instance/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:volume/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:network-interface/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:launch-template/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:spot-instances-request/*"
    ]
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:RequestTag/kubernetes.io/cluster/${var.cluster_name}"
    }
    condition {
      test     = "StringEquals"
      values   = [var.cluster_name]
      variable = "aws:RequestTag/eks:eks-cluster-name"
    }
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:RequestTag/karpenter.sh/nodepool"
    }
  }


  statement {
    sid    = "AllowScopedResourceCreationTagging"
    effect = "Allow"
    actions = [
      "ec2:CreateTags"
    ]
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}:*:fleet/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:instance/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:volume/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:network-interface/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:launch-template/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:spot-instances-request/*"
    ]

    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:RequestTag/kubernetes.io/cluster/${var.cluster_name}"
    }
    condition {
      test     = "StringEquals"
      values   = [var.cluster_name]
      variable = "aws:RequestTag/eks:eks-cluster-name"
    }
    condition {
      test = "StringEquals"
      values = [
        "RunInstances",
        "CreateFleet",
        "CreateLaunchTemplate"
      ]
      variable = "ec2:CreateAction"
    }
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:RequestTag/karpenter.sh/nodepool"
    }
  }

  statement {
    sid    = "AllowScopedResourceTagging"
    effect = "Allow"
    actions = [
      "ec2:CreateTags"
    ]
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}:*:instance/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:spot-instances-request/*"
    ]
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:ResourceTag/kubernetes.io/cluster/${var.cluster_name}"
    }
    condition {
      test     = "StringEqualsIfExists"
      values   = [var.cluster_name]
      variable = "aws:RequestTag/eks:eks-cluster-name"
    }
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:ResourceTag/karpenter.sh/nodepool"
    }
    condition {
      test = "ForAllValues:StringEquals"
      values = [
        "karpenter.sh/nodeclaim",
        "Name",
        "eks:eks-cluster-name"
      ]
      variable = "aws:TagKeys"
    }
  }

  statement {
    sid    = "AllowScopedDeletion"
    effect = "Allow"
    actions = [
      "ec2:TerminateInstances",
      "ec2:DeleteLaunchTemplate"
    ]
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}:*:instance/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:launch-template/*"
    ]
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:ResourceTag/kubernetes.io/cluster/${var.cluster_name}"
    }
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:ResourceTag/karpenter.sh/nodepool"
    }
  }

  statement {
    sid    = "AllowRegionalReadActions"
    effect = "Allow"
    actions = [
      "ec2:DescribeAvailabilityZones",
      "ec2:DescribeImages",
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceTypeOfferings",
      "ec2:DescribeInstanceTypes",
      "ec2:DescribeLaunchTemplates",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSpotPriceHistory",
      "ec2:DescribeSubnets"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      values   = [data.aws_region.main.name]
      variable = "aws:RequestedRegion"
    }
  }

  statement {
    sid       = "AllowSSMReadActions"
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${data.aws_region.main.name}::parameter/aws/service/*"]
  }

  statement {
    sid       = "AllowPricingReadActions"
    effect    = "Allow"
    actions   = ["pricing:GetProducts"]
    resources = ["*"]
  }

  statement {
    sid    = "AllowInterruptionQueueActions"
    effect = "Allow"
    actions = [
      "sqs:DeleteMessage",
      "sqs:GetQueueUrl",
      "sqs:ReceiveMessage"
    ]
    resources = [aws_sqs_queue.karpenter.arn]
  }

  statement {
    sid    = "AllowPassingInstanceRole"
    effect = "Allow"
    actions = [
      "iam:PassRole",
    ]
    resources = [var.node_role_arn]
    condition {
      test     = "StringEquals"
      values   = ["ec2.amazonaws.com", "ec2.amazonaws.com.cn"]
      variable = "iam:PassedToService"
    }
  }

  statement {
    sid    = "AllowScopedInstanceProfileCreationActions"
    effect = "Allow"
    actions = [
      "iam:CreateInstanceProfile"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:RequestTag/kubernetes.io/cluster/${var.cluster_name}"
    }
    condition {
      test     = "StringEquals"
      values   = [var.cluster_name]
      variable = "aws:RequestTag/eks:eks-cluster-name"
    }
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:RequestTag/karpenter.k8s.aws/ec2nodeclass"
    }
    condition {
      test     = "StringEquals"
      values   = [data.aws_region.main.name]
      variable = "aws:RequestTag/topology.kubernetes.io/region"
    }
  }

  statement {
    sid    = "AllowScopedInstanceProfileTagActions"
    effect = "Allow"
    actions = [
      "iam:TagInstanceProfile"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:RequestTag/kubernetes.io/cluster/${var.cluster_name}"
    }
    condition {
      test     = "StringEquals"
      values   = [var.cluster_name]
      variable = "aws:RequestTag/eks:eks-cluster-name"
    }
    condition {
      test     = "StringEquals"
      values   = [data.aws_region.main.name]
      variable = "aws:RequestTag/topology.kubernetes.io/region"
    }
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:ResourceTag/kubernetes.io/cluster/${var.cluster_name}"
    }
    condition {
      test     = "StringEquals"
      values   = [data.aws_region.main.name]
      variable = "aws:ResourceTag/topology.kubernetes.io/region"
    }
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:RequestTag/karpenter.k8s.aws/ec2nodeclass"
    }
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:ResourceTag/karpenter.k8s.aws/ec2nodeclass"
    }
  }

  statement {
    sid    = "AllowScopedInstanceProfileActions"
    effect = "Allow"
    actions = [
      "iam:AddRoleToInstanceProfile",
      "iam:RemoveRoleFromInstanceProfile",
      "iam:DeleteInstanceProfile"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:ResourceTag/kubernetes.io/cluster/${var.cluster_name}"
    }
    condition {
      test     = "StringEquals"
      values   = [data.aws_region.main.name]
      variable = "aws:ResourceTag/topology.kubernetes.io/region"
    }
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:ResourceTag/karpenter.k8s.aws/ec2nodeclass"
    }
  }

  statement {
    sid       = "AllowInstanceProfileReadActions"
    effect    = "Allow"
    actions   = ["iam:GetInstanceProfile"]
    resources = ["*"]
  }

  statement {
    sid    = "AllowAPIServerEndpointDiscovery"
    effect = "Allow"
    actions = [
      "eks:DescribeCluster",
    ]
    resources = ["arn:aws:eks:${data.aws_region.main.name}:${data.aws_caller_identity.main.account_id}:cluster/${var.cluster_name}"]
  }
}

resource "kubernetes_service_account" "karpenter" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.util.labels
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.karpenter.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.cluster_name
  iam_policy_json           = data.aws_iam_policy_document.karpenter.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}

resource "helm_release" "karpenter_crds" {
  namespace       = local.namespace
  name            = "karpenter-crd"
  repository      = "oci://public.ecr.aws/karpenter"
  chart           = "karpenter-crd"
  version         = var.karpenter_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  force_update    = true # required b/c the CRDs might already be installed
  max_history     = 5
}

resource "helm_release" "karpenter" {
  namespace       = local.namespace
  name            = "karpenter"
  repository      = "oci://public.ecr.aws/karpenter"
  chart           = "karpenter"
  version         = var.karpenter_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  skip_crds       = true # managed above
  max_history     = 5

  values = [
    yamlencode({
      nameOverride     = local.name
      fullnameOverride = local.name
      podLabels        = module.util.labels
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.karpenter.metadata[0].name
      }

      controller = {
        image = {
          repository = "${module.pull_through.ecr_public_registry}/karpenter/controller"
        }
        resources = {
          requests = {
            memory = "400Mi"
          }
          limits = {
            memory = "520Mi"
          }
        }
      }

      webhook = {
        enabled = true
      }

      serviceMonitor = {
        enabled          = var.monitoring_enabled
        additionalLabels = module.util.labels
        endpointConfig = {
          scrapeInterval = "60s"
        }
      }

      priorityClassName = "system-cluster-critical"

      replicas                  = 1
      topologySpreadConstraints = module.util.topology_spread_constraints
      tolerations               = module.util.tolerations
      # affinity                  = module.util.affinity // This breaks the helm chart for some reason
      strategy = {
        type          = "Recreate"
        rollingUpdate = null
      }
      nodeSelector = {
        "kubernetes.io/os"    = "linux",
        "panfactum.com/class" = "controller" # MUST be scheduled on controller nodes (controller by EKS)
      }
      settings = {
        clusterName       = var.cluster_name
        interruptionQueue = aws_sqs_queue.karpenter.name
        featureGates = {
          spotToSpotConsolidation = true
        }

        // Due to the way the VPA sets resource requests and limits (mutating webhook)
        // Karpenter does not know in advance how many resources the daemonsets
        // will need. As a result, it may schedule nodes that can only run
        // the daemonsets (and not other pending pods). This will create an infinite
        // scale-up loop.
        // To mitigate this, we provide a generous amount of spare overhead capacity
        // during its sizing calculations by bumping vmMemoryOverheadPercent significantly.
        // This ensures that new nodes can run the dynamically sized daemonsets
        // as well as the other pods.
        vmMemoryOverheadPercent = "0.3"
      }

      logConfig = {
        enabled     = true
        logEncoding = "json",
        logLevel = {
          controller = var.log_level
          webhook    = var.log_level
          global     = var.log_level
        }
      }
    })
  ]

  depends_on = [helm_release.karpenter_crds]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "karpenter-dashboard"
    labels = merge(module.util.labels, { "grafana_dashboard" = "1" })
  }
  data = {
    "karpenter.json" = file("${path.module}/dashboard.json")
  }
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = local.name
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = local.name
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.karpenter]
}
