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

  name      = "ingress-alb"
  namespace = module.namespace.namespace
  selector = {
    "app.kubernetes.io/name" = "aws-load-balancer-controller"
  }

}

module "labels" {
  source            = "../kube_labels"
  additional_labels = {}
  app               = var.app
  environment       = var.environment
  module            = var.module
  region            = var.region
  version_tag       = var.version_tag
  version_hash      = var.version_hash
  is_local          = var.is_local
}

module "constants" {
  source       = "../constants"
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "namespace" {
  source            = "../kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  linkerd_inject    = false
  app               = var.app
  environment       = var.environment
  module            = var.module
  region            = var.region
  version_tag       = var.version_tag
  version_hash      = var.version_hash
  is_local          = var.is_local
}

/********************************************************************************************************************
* AWS Load Balancer Controller
*********************************************************************************************************************/

data "aws_region" "main" {}

data "aws_vpc" "vpc" {
  id = var.vpc_id
}

data "aws_subnet" "nlb_subnets" {
  for_each = var.nlb_subnets
  filter {
    name   = "tag:Name"
    values = [each.value]
  }
}

resource "aws_ec2_tag" "vpc_tag" {
  for_each    = var.nlb_subnets
  resource_id = data.aws_subnet.nlb_subnets[each.key].id
  key         = "kubernetes.io/role/elb"
  value       = "1"
}

data "aws_iam_policy_document" "alb" {
  statement {
    effect = "Allow"
    actions = [
      "iam:CreateServiceLinkedRole"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      values   = ["elasticloadbalancing.amazonaws.com"]
      variable = "iam:AWSServiceName"
    }
  }

  statement {
    effect = "Allow"
    actions = [
      "ec2:DescribeAccountAttributes",
      "ec2:DescribeAddresses",
      "ec2:DescribeAvailabilityZones",
      "ec2:DescribeInternetGateways",
      "ec2:DescribeVpcs",
      "ec2:DescribeVpcPeeringConnections",
      "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeInstances",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeTags",
      "ec2:GetCoipPoolUsage",
      "ec2:DescribeCoipPools",
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticloadbalancing:DescribeLoadBalancerAttributes",
      "elasticloadbalancing:DescribeListeners",
      "elasticloadbalancing:DescribeListenerCertificates",
      "elasticloadbalancing:DescribeSSLPolicies",
      "elasticloadbalancing:DescribeRules",
      "elasticloadbalancing:DescribeTargetGroups",
      "elasticloadbalancing:DescribeTargetGroupAttributes",
      "elasticloadbalancing:DescribeTargetHealth",
      "elasticloadbalancing:DescribeTags"
    ]
    resources = ["*"]
  }
  statement {
    effect = "Allow"
    actions = [
      "cognito-idp:DescribeUserPoolClient",
      "acm:ListCertificates",
      "acm:DescribeCertificate",
      "iam:ListServerCertificates",
      "iam:GetServerCertificate",
      "waf-regional:GetWebACL",
      "waf-regional:GetWebACLForResource",
      "waf-regional:AssociateWebACL",
      "waf-regional:DisassociateWebACL",
      "wafv2:GetWebACL",
      "wafv2:GetWebACLForResource",
      "wafv2:AssociateWebACL",
      "wafv2:DisassociateWebACL",
      "shield:GetSubscriptionState",
      "shield:DescribeProtection",
      "shield:CreateProtection",
      "shield:DeleteProtection"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupIngress"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "ec2:CreateSecurityGroup",
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "ec2:CreateTags"
    ]
    resources = ["arn:aws:ec2:*:*:security-group/*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "ec2:CreateTags",
      "ec2:DeleteTags"
    ]
    resources = ["arn:aws:ec2:*:*:security-group/*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:DeleteSecurityGroup"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "elasticloadbalancing:CreateLoadBalancer",
      "elasticloadbalancing:CreateTargetGroup"
    ]
    resources = ["*"]
    condition {
      test     = "Null"
      values   = ["false"]
      variable = "aws:RequestTag/elbv2.k8s.aws/cluster"
    }
  }

  statement {
    effect = "Allow"
    actions = [
      "elasticloadbalancing:CreateListener",
      "elasticloadbalancing:DeleteListener",
      "elasticloadbalancing:CreateRule",
      "elasticloadbalancing:DeleteRule"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "elasticloadbalancing:AddTags",
      "elasticloadbalancing:RemoveTags"
    ]
    resources = [
      "arn:aws:elasticloadbalancing:*:*:targetgroup/*/*",
      "arn:aws:elasticloadbalancing:*:*:loadbalancer/net/*/*",
      "arn:aws:elasticloadbalancing:*:*:loadbalancer/app/*/*"
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "elasticloadbalancing:AddTags",
      "elasticloadbalancing:RemoveTags"
    ]
    resources = [
      "arn:aws:elasticloadbalancing:*:*:listener/net/*/*/*",
      "arn:aws:elasticloadbalancing:*:*:listener/app/*/*/*",
      "arn:aws:elasticloadbalancing:*:*:listener-rule/net/*/*/*",
      "arn:aws:elasticloadbalancing:*:*:listener-rule/app/*/*/*"
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "elasticloadbalancing:ModifyLoadBalancerAttributes",
      "elasticloadbalancing:SetIpAddressType",
      "elasticloadbalancing:SetSecurityGroups",
      "elasticloadbalancing:SetSubnets",
      "elasticloadbalancing:DeleteLoadBalancer",
      "elasticloadbalancing:ModifyTargetGroup",
      "elasticloadbalancing:ModifyTargetGroupAttributes",
      "elasticloadbalancing:DeleteTargetGroup"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "elasticloadbalancing:RegisterTargets",
      "elasticloadbalancing:DeregisterTargets"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "elasticloadbalancing:SetWebAcl",
      "elasticloadbalancing:ModifyListener",
      "elasticloadbalancing:AddListenerCertificates",
      "elasticloadbalancing:RemoveListenerCertificates",
      "elasticloadbalancing:ModifyRule"
    ]
    resources = ["*"]
  }
}

resource "kubernetes_service_account" "alb_controller" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.labels.kube_labels
  }
}

module "aws_permissions" {
  source                    = "../kube_sa_auth_aws"
  service_account           = kubernetes_service_account.alb_controller.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.alb.json
  ip_allow_list             = var.ip_allow_list
  app                       = var.app
  environment               = var.environment
  module                    = var.module
  region                    = var.region
  version_tag               = var.version_tag
  version_hash              = var.version_hash
  is_local                  = var.is_local
}

resource "helm_release" "alb_controller" {
  namespace       = local.namespace
  name            = "eks"
  repository      = "https://aws.github.io/eks-charts"
  chart           = "aws-load-balancer-controller"
  version         = var.alb_controller_helm_version
  recreate_pods   = false
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 3

  values = [
    yamlencode({

      ingressClass = "alb"
      image = {
        tag = var.alb_controller_version
      }
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.alb_controller.metadata[0].name
      }

      // DOES need to be highly available to avoid ingress disruptions
      replicaCount = 2
      affinity = merge({
        podAntiAffinity = {
          requiredDuringSchedulingIgnoredDuringExecution = [{
            topologyKey = "kubernetes.io/hostname"
            labelSelector = {
              matchLabels = {
                "app.kubernetes.io/name" = "aws-load-balancer-controller"
              }
            }
          }]
        }
      }, module.constants.controller_node_affinity_helm)

      updateStrategy = {
        type = "RollingUpdate"
        rollingUpdate = {
          maxSurge       = "50%"
          maxUnavailable = 0
        }
      }
      podDisruptionBudget = {
        maxUnavailable = 1
      }
      configureDefaultAffinity = true
      priorityClassName        = module.constants.cluster_important_priority_class_name
      clusterName              = var.eks_cluster_name
      region                   = data.aws_region.main.name
      vpcId                    = var.vpc_id
      additionalLabels = merge(module.labels.kube_labels, {
        customizationHash = md5(join("", [for filename in sort(fileset(path.module, "alb_kustomize/*")) : filesha256(filename)]))
      })
      deploymentAnnotations = {
        "reloader.stakater.com/auto" = "true"
      }
      podAnnotations = {
        "linkerd.io/inject" = "enabled"
      }

      // The ONLY alb ingress in our system should be the LB services in the repo;
      // EVERYTHING else should go through NGINX.
      // That means we can scope this controller to this namespace which will
      // limit the blast radius if the webhooks in this chart go down
      webhookNamespaceSelectors = [{
        key      = "loadbalancer/enabled"
        operator = "In"
        values   = ["true"]
      }]

      // This is necessary for zero-downtime rollovers of the nginx ingress pods
      // https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.4/deploy/pod_readiness_gate/
      enablePodReadinessGateInject = true

      // This appears to be the only way to use cert-manager for the certificate generation;
      // manually spinning up certificates does not work
      enableCertManager = true
    })
  ]

  // We want to use our secured internal certs rather than their
  // default self-signed one
  postrender {
    binary_path = "${path.module}/alb_kustomize/kustomize.sh"
  }

  depends_on = [
    module.aws_permissions
  ]
}

resource "kubernetes_service" "alb_controller_healthcheck" {
  metadata {
    name      = "alb-controller-healthcheck"
    namespace = local.namespace
    labels    = module.labels.kube_labels
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 80
      target_port = 61779 // healthcheck port
      protocol    = "TCP"
    }
    selector = local.selector
  }
  depends_on = [helm_release.alb_controller]
}

resource "kubernetes_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "eks-aws-load-balancer-controller"
      namespace = local.namespace
      labels    = module.labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "eks-aws-load-balancer-controller"
      }
    }
  }
}