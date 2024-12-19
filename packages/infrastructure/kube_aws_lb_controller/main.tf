// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

locals {
  name      = "alb-controller"
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_aws_lb_controller"
}

data "pf_aws_tags" "tags" {
  module = "kube_aws_lb_controller"
}

data "pf_metadata" "metadata" {}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "alb-controller"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  host_anti_affinity_required          = var.sla_target >= 2
  az_spread_preferred                  = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace      = local.name
  linkerd_inject = false
}

/********************************************************************************************************************
* AWS Load Balancer Controller
*********************************************************************************************************************/

data "aws_region" "main" {}

data "aws_vpc" "vpc" {
  id = var.vpc_id
}

data "aws_subnet" "nlb_subnets" {
  for_each = var.subnets
  vpc_id   = var.vpc_id
  filter {
    name   = "tag:Name"
    values = [each.value]
  }
}

resource "aws_ec2_tag" "vpc_tag" {
  for_each    = var.subnets
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
      "ec2:GetSecurityGroupsForVpc",
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticloadbalancing:DescribeLoadBalancerAttributes",
      "elasticloadbalancing:DescribeListeners",
      "elasticloadbalancing:DescribeListenerCertificates",
      "elasticloadbalancing:DescribeSSLPolicies",
      "elasticloadbalancing:DescribeRules",
      "elasticloadbalancing:DescribeTargetGroups",
      "elasticloadbalancing:DescribeTargetGroupAttributes",
      "elasticloadbalancing:DescribeTargetHealth",
      "elasticloadbalancing:DescribeTags",
      "elasticloadbalancing:DescribeTrustStores",
      "elasticloadbalancing:DescribeListenerAttributes",
      "elasticloadbalancing:DescribeCapacityReservation"
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
    condition {
      test     = "StringEquals"
      values   = ["CreateSecurityGroup"]
      variable = "ec2:CreateAction"
    }
    condition {
      test     = "Null"
      values   = ["false"]
      variable = "aws:RequestTag/elbv2.k8s.aws/cluster"
    }
  }

  statement {
    effect = "Allow"
    actions = [
      "ec2:CreateTags",
      "ec2:DeleteTags"
    ]
    resources = ["arn:aws:ec2:*:*:security-group/*"]
    condition {
      test     = "Null"
      values   = ["false"]
      variable = "aws:ResourceTag/elbv2.k8s.aws/cluster"
    }
    condition {
      test     = "Null"
      values   = ["true"]
      variable = "aws:RequestTag/elbv2.k8s.aws/cluster"
    }
  }

  statement {
    effect = "Allow"
    actions = [
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:DeleteSecurityGroup"
    ]
    resources = ["*"]
    condition {
      test     = "Null"
      values   = ["false"]
      variable = "aws:ResourceTag/elbv2.k8s.aws/cluster"
    }
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
    condition {
      test     = "Null"
      values   = ["false"]
      variable = "aws:ResourceTag/elbv2.k8s.aws/cluster"
    }
    condition {
      test     = "Null"
      values   = ["true"]
      variable = "aws:RequestTag/elbv2.k8s.aws/cluster"
    }
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
    condition {
      test     = "Null"
      values   = ["false"]
      variable = "aws:ResourceTag/elbv2.k8s.aws/cluster"
    }
  }

  statement {
    effect = "Allow"
    actions = [
      "elasticloadbalancing:AddTags"
    ]
    resources = [
      "arn:aws:elasticloadbalancing:*:*:targetgroup/*/*",
      "arn:aws:elasticloadbalancing:*:*:loadbalancer/net/*/*",
      "arn:aws:elasticloadbalancing:*:*:loadbalancer/app/*/*"
    ]
    condition {
      test = "StringEquals"
      values = [
        "CreateTargetGroup",
        "CreateLoadBalancer"
      ]
      variable = "elasticloadbalancing:CreateAction"
    }
    condition {
      test     = "Null"
      values   = ["false"]
      variable = "aws:RequestTag/elbv2.k8s.aws/cluster"
    }
  }

  statement {
    effect = "Allow"
    actions = [
      "elasticloadbalancing:RegisterTargets",
      "elasticloadbalancing:DeregisterTargets"
    ]
    resources = ["arn:aws:elasticloadbalancing:*:*:targetgroup/*/*"]
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
    labels    = module.util_controller.labels
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.alb_controller.metadata[0].name
  service_account_namespace = local.namespace
  iam_policy_json           = data.aws_iam_policy_document.alb.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}

resource "aws_security_group" "backend" {
  vpc_id      = var.vpc_id
  name_prefix = "alb-controller-backend-"
  description = "The backend security group for the ALB ingress controller"
  tags        = data.pf_aws_tags.tags.tags
}

// This is required b/c the helm chart does not automatically upgrade the CRDs
data "kubectl_file_documents" "crds" {
  content = file("${path.module}/crds.yaml")
}
resource "kubectl_manifest" "crds" {
  count             = length(data.kubectl_file_documents.crds.documents)
  yaml_body         = element(data.kubectl_file_documents.crds.documents, count.index)
  force_conflicts   = true
  server_side_apply = true
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
      fullnameOverride = "alb-controller"

      ingressClass = "alb"
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.alb_controller.metadata[0].name
      }
      deploymentAnnotations = {
        "reloader.stakater.com/auto" = "true"
      }
      podAnnotations = {
        "linkerd.io/inject"                      = "enabled"
        "config.linkerd.io/proxy-memory-request" = "5Mi"
      }
      podLabels = module.util_controller.labels
      additionalLabels = merge(module.util_controller.labels, {
        customizationHash = md5(join("", [for filename in sort(fileset(path.module, "alb_kustomize/*")) : filesha256(filename)]))
      })
      resources = {
        requests = {
          memory = "${floor(85 / 1.3)}Mi"
        }
        limits = {
          memory = "85Mi"
        }
      }

      replicaCount      = var.sla_target >= 2 ? 2 : 1
      priorityClassName = module.constants.cluster_important_priority_class_name
      affinity          = module.util_controller.affinity
      updateStrategy = {
        type = "Recreate"
      }
      tolerations               = module.util_controller.tolerations
      topologySpreadConstraints = module.util_controller.topology_spread_constraints
      podDisruptionBudget = {
        maxUnavailable             = 1
        unhealthyPodEvictionPolicy = "AlwaysAllow"
      }
      updateStrategy = {
        type = "RollingUpdate"
        rollingUpdate = {
          maxSurge       = "50%"
          maxUnavailable = 0
        }
      }
      configureDefaultAffinity = false

      clusterName                = data.pf_metadata.metadata.kube_cluster_name
      region                     = data.aws_region.main.name
      vpcId                      = var.vpc_id
      enableBackendSecurityGroup = true
      backendSecurityGroup       = aws_security_group.backend.id
      logLevel                   = var.log_level

      // The ONLY alb ingress in our system should be the LB services in the repo;
      // EVERYTHING else should go through NGINX.
      // That means we can scope this controller to specific namespaces which will
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

      serviceMonitor = {
        enabled   = var.monitoring_enabled
        namespace = local.namespace
        interval  = "60s"
      }
    })
  ]

  postrender {
    binary_path = "${path.module}/alb_kustomize/kustomize.sh"
  }

  depends_on = [
    kubectl_manifest.crds,
    module.aws_permissions
  ]
}

resource "kubernetes_service" "alb_controller_healthcheck" {
  metadata {
    name      = "alb-controller-healthcheck"
    namespace = local.namespace
    labels    = module.util_controller.labels
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 80
      target_port = 61779 // healthcheck port
      protocol    = "TCP"
    }
    selector = module.util_controller.match_labels
  }
  depends_on = [helm_release.alb_controller]
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "alb-controller"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "aws-load-balancer-controller"
          minAllowed = {
            memory = "${floor(85 / 1.3)}Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "alb-controller"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.alb_controller]
}
