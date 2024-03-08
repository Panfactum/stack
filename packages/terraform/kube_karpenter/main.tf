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
  }
}

locals {

  name      = "karpenter"
  namespace = module.namespace.namespace

}

module "kube_labels" {
  source = "../kube_labels"
  additional_labels = {
    service = local.name
  }
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

data "aws_region" "main" {}
data "aws_caller_identity" "main" {}

module "constants" {
  source          = "../constants"
  matching_labels = module.kube_labels.kube_labels
  app             = var.app
  environment     = var.environment
  module          = var.module
  region          = var.region
  version_tag     = var.version_tag
  version_hash    = var.version_hash
  is_local        = var.is_local
}

module "namespace" {
  source            = "../kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  app               = var.app
  environment       = var.environment
  module            = var.module
  region            = var.region
  version_tag       = var.version_tag
  version_hash      = var.version_hash
  is_local          = var.is_local
}

// Tagging to enable Karpenter autodiscovery
data "aws_subnet" "nlb_subnets" {
  for_each = var.node_subnets
  filter {
    name   = "tag:Name"
    values = [each.value]
  }
}

resource "aws_ec2_tag" "vpc_tag" {
  for_each    = var.node_subnets
  resource_id = data.aws_subnet.nlb_subnets[each.key].id
  key         = "karpenter.sh/discovery"
  value       = var.eks_cluster_name
}


/********************************************************************************************************************
* AWS Termination Queue Resources
*********************************************************************************************************************/

resource "aws_sqs_queue" "karpenter" {
  name_prefix               = "${var.eks_cluster_name}-"
  message_retention_seconds = 300
  sqs_managed_sse_enabled   = true
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
    sid    = "AllowScopedEC2InstanceActions"
    effect = "Allow"
    actions = [
      "ec2:RunInstances",
      "ec2:CreateFleet"
    ]
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}::image/*",
      "arn:aws:ec2:${data.aws_region.main.name}::snapshot/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:spot-instances-request/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:security-group/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:subnet/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:launch-template/*"
    ]
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
      "arn:aws:ec2:${data.aws_region.main.name}:*:launch-template/*"
    ]
  }


  statement {
    sid    = "AllowScopedResourceCreationTagging"
    effect = "Allow"
    actions = [
      "ec2:CreateTags"
    ]
    condition {
      test = "StringEquals"
      values = [
        "RunInstances",
        "CreateFleet",
        "CreateLaunchTemplate"
      ]
      variable = "ec2:CreateAction"
    }
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}:*:fleet/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:instance/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:volume/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:network-interface/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:launch-template/*"
    ]
  }

  statement {
    sid    = "AllowMachineMigrationTagging"
    effect = "Allow"
    actions = [
      "ec2:CreateTags"
    ]
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:ResourceTag/kubernetes.io/cluster/${var.eks_cluster_name}"
    }
    condition {
      test = "ForAllValues:StringEquals"
      values = [
        "karpenter.sh/provisioner-name",
        "karpenter.sh/managed-by"
      ]
      variable = "aws:TagKeys"
    }
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}:*:instance/*"
    ]
  }

  statement {
    sid    = "AllowScopedDeletion"
    effect = "Allow"
    actions = [
      "ec2:TerminateInstances",
      "ec2:DeleteLaunchTemplate"
    ]
    condition {
      test     = "StringLike"
      values   = ["*"]
      variable = "ec2:ResourceTag/karpenter.sh/provisioner-name"
    }
    condition {
      test     = "StringEquals"
      values   = ["owned"]
      variable = "aws:ResourceTag/kubernetes.io/cluster/${var.eks_cluster_name}"
    }
    resources = [
      "arn:aws:ec2:${data.aws_region.main.name}:*:instance/*",
      "arn:aws:ec2:${data.aws_region.main.name}:*:launch-template/*"
    ]
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
    condition {
      test     = "StringEquals"
      values   = [data.aws_region.main.name]
      variable = "aws:RequestedRegion"
    }
    resources = ["*"]
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
      "sqs:GetQueueAttributes",
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
    resources = [var.eks_node_role_arn]
    condition {
      test     = "StringEquals"
      values   = ["ec2.amazonaws.com"]
      variable = "iam:PassedToService"
    }
  }
  statement {
    sid    = "AllowAPIServerEndpointDiscovery"
    effect = "Allow"
    actions = [
      "eks:DescribeCluster",
    ]
    resources = ["arn:aws:eks:${data.aws_region.main.name}:${data.aws_caller_identity.main.account_id}:cluster/${var.eks_cluster_name}"]
  }
}

resource "kubernetes_service_account" "karpenter" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
}

module "aws_permissions" {
  source                    = "../kube_sa_auth_aws"
  service_account           = kubernetes_service_account.karpenter.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.karpenter.json
  ip_allow_list             = var.ip_allow_list
  app                       = var.app
  environment               = var.environment
  module                    = var.module
  region                    = var.region
  version_tag               = var.version_tag
  version_hash              = var.version_hash
  is_local                  = var.is_local
}

resource "helm_release" "karpenter" {
  namespace       = local.namespace
  name            = "karpenter"
  repository      = "oci://public.ecr.aws/karpenter"
  chart           = "karpenter"
  version         = var.karpenter_helm_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      nameOverride     = local.name
      fullnameOverride = local.name
      podLabels        = module.kube_labels.kube_labels

      // For some reason, the default DNS policy is not the kubernetes default
      // (it is "Default" but the kubernetes default is "ClusterFirst")
      // This breaks our service mesh and doesn"t allow these pods to start
      dnsPolicy = "ClusterFirst"

      priorityClassName = "system-cluster-critical"

      serviceAccount = {
        create = false
        name   = kubernetes_service_account.karpenter.metadata[0].name
      }

      affinity = merge(
        module.constants.controller_node_affinity_helm,
        module.constants.pod_anti_affinity_helm
      )

      settings = {
        aws = {
          defaultInstanceProfile = var.eks_node_instance_profile
          clusterName            = var.eks_cluster_name
          interruptionQueueName  = aws_sqs_queue.karpenter.name
        }
      }
    })
  ]
}

resource "kubernetes_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = local.name
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = local.name
      }
    }
  }
}
