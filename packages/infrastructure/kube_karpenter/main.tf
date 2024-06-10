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
      version = "5.39.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

data "aws_region" "main" {}
data "aws_caller_identity" "main" {}

locals {
  name      = "karpenter"
  namespace = module.namespace.namespace
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "util" {
  source                   = "../kube_workload_utility"
  workload_name            = "karpenter"
  topology_spread_enabled  = false
  controller_node_required = true

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

module "tags" {
  source = "../aws_tags"

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

/********************************************************************************************************************
* Subnet Tagging to enable autodiscovery
*********************************************************************************************************************/

data "aws_subnet" "node_subnets" {
  for_each = var.node_subnets
  vpc_id   = var.node_vpc_id
  filter {
    name   = "tag:Name"
    values = [each.value]
  }
}

resource "aws_ec2_tag" "subnet_tags" {
  for_each    = var.node_subnets
  resource_id = data.aws_subnet.node_subnets[each.key].id
  key         = "karpenter.sh/discovery"
  value       = var.cluster_name
}

resource "aws_ec2_tag" "security_group_tag" {
  resource_id = var.node_security_group_id
  key         = "karpenter.sh/discovery"
  value       = var.cluster_name
}

/********************************************************************************************************************
* AWS Termination Queue Resources
*********************************************************************************************************************/

resource "aws_sqs_queue" "karpenter" {
  name_prefix               = "${var.cluster_name}-"
  message_retention_seconds = 300
  sqs_managed_sse_enabled   = true
  tags = merge(module.tags.tags, {
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
  tags = module.tags.tags
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
  tags = module.tags.tags
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
  tags = module.tags.tags
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
  tags = module.tags.tags
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
      test     = "StringLike"
      values   = ["*"]
      variable = "aws:ResourceTag/karpenter.sh/nodepool"
    }
    condition {
      test = "ForAllValues:StringEquals"
      values = [
        "karpenter.sh/nodeclaim",
        "Name"
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
      values   = ["ec2.amazonaws.com"]
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
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].ecr_public_registry : "public.ecr.aws"}/karpenter/controller"
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

      serviceMonitor = {
        enabled          = var.monitoring_enabled
        additionalLabels = module.util.labels
        endpointConfig = {
          scrapeInterval = "60s"
        }
      }

      priorityClassName = "system-cluster-critical"

      replicas = 1
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
