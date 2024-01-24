// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.10.1"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.10"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.0.4"
    }
  }
}

locals {

  name         = "ingress"
  nginx_name   = "ingress-nginx"
  alb_name     = "alb-controller"
  bastion_name = "bastion"
  namespace    = module.namespace.namespace

  nginx_selector = {
    "app.kubernetes.io/component" = "controller"
    "app.kubernetes.io/instance"  = "ingress-nginx"
    "app.kubernetes.io/name"      = "ingress-nginx"
  }
  alb_selector = {
    "app.kubernetes.io/name" = "aws-load-balancer-controller"
  }
  bastion_selector = {
    module    = var.module
    submodule = local.bastion_name
  }

  // This has to be THIS name in order for it to
  // replace the self-generated cert secret from the helm chart
  webhook_secret = "ingress-nginx-admission"

  ingress_secret = "ingress-nginx-tls"

  // Number of seconds to wait for data before terminating connections;
  // Used for both upstream and downstream logic
  nginx_base_timeout = var.ingress_timeout

  // Number of seconds it takes to de-register targets from the NLB
  // (even though you can set this to < 5 minutes, there appears to be a consistent floor of about 5 minutes)
  // https://github.com/kubernetes-sigs/aws-load-balancer-controller/issues/2366#issuecomment-1118312709
  deregistration_delay = 60

  csp_config = {
    default-src = [
      "'self'"
    ]
    connect-src     = ["'self'", "ws:"]
    base-uri        = ["'self'"]
    font-src        = ["'self'", "https:", "data:"]
    form-action     = ["'self'"]
    frame-ancestors = ["'self'"]
    img-src = [
      "'self'",
      "data:"
    ]
    object-src = ["'none'"]
    script-src = [
      "'self'",
      "'unsafe-inline'", # Added for grafana
      "'unsafe-eval'"    # Added for grafana
    ]
    style-src = ["'self'", "https:", "'unsafe-inline'"]
  }

  nlb_common_annotations = {
    "service.beta.kubernetes.io/aws-load-balancer-type"                            = "external"
    "service.beta.kubernetes.io/aws-load-balancer-backend-protocol"                = "tcp"
    "service.beta.kubernetes.io/aws-load-balancer-scheme"                          = "internet-facing"
    "service.beta.kubernetes.io/aws-load-balancer-nlb-target-type"                 = "ip"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-unhealthy-threshold" = "2"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-healthy-threshold"   = "2"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-timeout"             = "2"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-interval"            = "5"
    "service.beta.kubernetes.io/aws-load-balancer-target-group-attributes" = join(",", [

      // Ensures a client always connects to the same backing server; important
      // for both performance and rate-limiting
      "stickiness.enabled=true",
      "stickiness.type=source_ip",

      // Preserve the client IP even when routing through the LB
      "preserve_client_ip.enabled=true",

      // This needs to be SHORTER than it takes for the NGINX pod to terminate as incoming connections
      // will only be stopped when this delay is met
      "deregistration_delay.timeout_seconds=${local.deregistration_delay}",
      "deregistration_delay.connection_termination.enabled=true"
    ])
    //TODO: "service.beta.kubernetes.io/aws-load-balancer-attributes" = "access_logs.s3.enabled=true,access_logs.s3.bucket=my-access-log-bucket,access_logs.s3.prefix=my-app"
  }
}

module "nginx_labels" {
  source = "../../modules/kube_labels"
  additional_labels = {
    submodule = local.nginx_name
  }
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

module "alb_labels" {
  source = "../../modules/kube_labels"
  additional_labels = {
    submodule = local.alb_name
  }
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

module "bastion_labels" {
  source = "../../modules/kube_labels"
  additional_labels = {
    submodule = local.bastion_name
  }
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

module "constants" {
  source = "../../modules/constants"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

module "namespace" {
  source            = "../../modules/kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  linkerd_inject    = false
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/********************************************************************************************************************
* AWS Load Balancer Controller
*********************************************************************************************************************/

data "aws_region" "main" {}

data "aws_vpc" "vpc" {
  id = var.vpc_id
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
    name      = local.alb_name
    namespace = local.namespace
    labels    = module.alb_labels.kube_labels
  }
}

module "aws_permissions" {
  source                    = "../../modules/kube_sa_auth_aws"
  service_account           = kubernetes_service_account.alb_controller.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.alb.json
  public_outbound_ips       = var.public_outbound_ips
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
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
      additionalLabels = merge(module.alb_labels.kube_labels, {
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
      watchNamespace = local.namespace
      webhookNamespaceSelectors = [{
        key      = "module"
        operator = "In"
        values   = [var.module]
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
    labels    = module.alb_labels.kube_labels
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 80
      target_port = 61779 // healthcheck port
      protocol    = "TCP"
    }
    selector = local.alb_selector
  }
  depends_on = [helm_release.alb_controller]
}

resource "kubernetes_manifest" "vpa_alb" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "eks-aws-load-balancer-controller"
      namespace = local.namespace
      labels    = module.alb_labels.kube_labels
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

/***********************************************
* NGINX
************************************************/

module "webhook_cert" {
  source        = "../../modules/kube_internal_cert"
  service_names = ["ingress-nginx-controller-admission"]
  secret_name   = local.webhook_secret
  namespace     = local.namespace
  labels        = module.nginx_labels.kube_labels
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

resource "kubernetes_manifest" "ingress_cert" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = local.ingress_secret
      namespace = local.namespace
    }
    spec = {
      secretName = local.ingress_secret
      dnsNames = flatten([for domain in var.ingress_domains : [
        domain
      ]])

      // We don't rotate this as frequently to both respect
      // the rate limits: https://letsencrypt.org/docs/rate-limits/
      // and to avoid getting the 30 day renewal reminders
      duration    = "2160h0m0s"
      renewBefore = "720h0m0s"

      privateKey = {
        rotationPolicy = "Always"
      }

      issuerRef = {
        name  = "public"
        kind  = "ClusterIssuer"
        group = "cert-manager.io"
      }
    }
  }
  wait {
    condition {
      type   = "Ready"
      status = "True"
    }
  }
}

resource "kubernetes_secret" "dhparam" {
  metadata {
    name      = "ingress-nginx-dhparam"
    namespace = local.namespace
    labels = merge(
      module.nginx_labels.kube_labels,
      {
        "app.kubernetes.io/name"    = "ingress-nginx"
        "app.kubernetes.io/part-of" = "ingress-nginx"
      }
    )
  }
  data = {
    "dhparam.pem" = var.dhparam
  }
}

resource "helm_release" "nginx_ingress" {
  namespace       = local.namespace
  name            = "ingress-nginx"
  repository      = "https://kubernetes.github.io/ingress-nginx"
  chart           = "ingress-nginx"
  version         = var.nginx_ingress_helm_version
  recreate_pods   = false
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 3

  values = [
    yamlencode({
      commonLabels = merge(module.nginx_labels.kube_labels,
        {
          customizationHash = md5(join("", [for filename in sort(fileset(path.module, "nginx_kustomize/*")) : filesha256(filename)]))
        }
      )
      controller = {
        image = {
          tag = var.nginx_ingress_version
        }

        replicaCount = var.min_replicas

        annotations = {
          // Required b/c the webhook certificate doesn't automatically renew
          "reloader.stakater.com/auto" = "true"
        }

        podAnnotations = {
          // Attach the service mesh sidecar
          "linkerd.io/inject" = "enabled"
        }

        // standard security headers
        addHeaders = {
          "X-Frame-Options"        = "SAMEORIGIN"
          "X-Content-Type-Options" = "nosniff"
          "X-XSS-Protection"       = "1"
          "Referrer-Policy"        = "no-referrer"

          // TODO: These items should be configured per-ingress rather than globally
          // This is possible by using the configuration snippet annotation
          // This MUST be done before we serve HTML sites through the ingress architecture
          // It is temporarily disabled as it was blocking development
          #          "Content-Security-Policy" = join("; ", concat(
          #            [for directive, config in local.csp_config: "${directive} ${join(" ", config)}"],
          #            ["upgrade-insecure-requests"]
          #          ))
          #          "Cross-Origin-Opener-Policy" =  "same-origin-allow-popups"
          #          "Cross-Origin-Resource-Policy" = "cross-origin"
        }

        extraArgs = {
          // Used so that we don't have to specify a secret on each ingress resource
          default-ssl-certificate = "${local.namespace}/${local.ingress_secret}"
        }

        // See https://kubernetes.github.io/ingress-nginx/deploy/hardening-guide/
        config = {

          // Sets up tracing (TODO)
          // enable-opentracing = "true"
          // opentracing-trust-incoming-span = "true"

          // Enable client-ip preservation
          proxy-add-original-uri-header = "true"
          use-forwarded-headers         = "true"
          use-proxy-protocol            = "true"
          enable-real-ip                = "true"
          proxy-real-ip-cidr            = "0.0.0.0/0"

          // Use HTTP/2
          use-http2 = "true"

          // Enable compression
          enable-brotli = "true"

          // Disable buffering
          proxy-buffering         = "off"
          proxy-request-buffering = "off"

          // Set buffering windows in case the buffering gets enabled
          proxy-buffer-size    = "64k"
          proxy-buffers-number = "16"

          // Logging
          log-format-escape-json                = "true"
          enable-access-log-for-default-backend = "true"
          log-format-upstream                   = file("${path.module}/nginx_log_format.txt")

          // Disable IPv6 for security
          disable-ipv6     = "true"
          disable-ipv6-dns = "true"

          // WAF
          enable-modsecurity  = "false" # TODO: enable
          modsecurity-snippet = file("${path.module}/modsecurity.txt")

          // Rate limiting
          limit-req-status-code  = "429"
          limit-conn-status-code = "429"

          // Timeouts and performance
          keep-alive                 = "${local.nginx_base_timeout}"
          client-header-timeout      = "${local.nginx_base_timeout}"
          client-body-timeout        = "${local.nginx_base_timeout}"
          proxy-body-size            = "10m"
          proxy-connect-timeout      = "${local.nginx_base_timeout}"
          proxy-read-timeout         = "${local.nginx_base_timeout}"
          proxy-send-timeout         = "${local.nginx_base_timeout}"
          proxy-next-upstream-timout = "${ceil(local.nginx_base_timeout * 2)}"
          load-balance               = "ewma"

          // SSL setup
          ssl-ciphers            = "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384"
          ssl-protocols          = "TLSv1.3"
          ssl-session-cache      = "true"
          ssl-session-cache-size = "100m"
          ssl-session-tickets    = "true"
          ssl-session-timeout    = "120m"
          ssl-dh-param           = "${local.namespace}/${kubernetes_secret.dhparam.metadata[0].name}" // https://kubernetes.github.io/ingress-nginx/examples/customization/ssl-dh-param/
          enable-ocsp            = "true"

          // HSTS setup
          hsts                    = "true"
          hsts-include-subdomains = "true"
          hsts-max-age            = "${10 * 365 * 24 * 60 * 60}"
          hsts-preload            = "true"

          // Hide identifying headers for security
          hide-headers = "server,x-powered-by"

          //
          http-snippet = file("${path.module}/nginx_status_snippet.txt")
        }
        service = {
          name              = local.nginx_name
          loadBalancerClass = "service.k8s.aws/nlb"
          annotations = merge(local.nlb_common_annotations, {
            "service.beta.kubernetes.io/aws-load-balancer-name"           = "ingress-nginx",
            "service.beta.kubernetes.io/aws-load-balancer-proxy-protocol" = "*"
          })
        }
        metrics = {
          enabled  = true
          port     = 10254
          portName = "metrics"
        }

        tolerations = module.constants.spot_node_toleration_helm
        affinity = {
          podAntiAffinity = {
            requiredDuringSchedulingIgnoredDuringExecution = [{
              labelSelector = {
                matchExpressions = [
                  {
                    key      = "app.kubernetes.io/component"
                    operator = "In"
                    values   = ["controller"]
                  },
                  {
                    key      = "app.kubernetes.io/instance"
                    operator = "In"
                    values   = ["ingress-nginx"]
                  }
                ]
              }
              topologyKey = "kubernetes.io/hostname"
            }]
          }
        }

        updateStrategy = {
          type = "RollingUpdate"
          rollingUpdate = {
            maxSurge       = "50%"
            maxUnavailable = 0
          }
        }
        minReadySeconds = 30
        minAvailable    = "50%"
        topologySpreadConstraints = [
          {
            maxSkew           = 1
            topologyKey       = "topology.kubernetes.io/zone"
            whenUnsatisfiable = "DoNotSchedule"
            labelSelector = {
              matchLabels = local.nginx_selector
            }
          },
          {
            maxSkew           = 1
            topologyKey       = "kubernetes.io/hostname"
            whenUnsatisfiable = "DoNotSchedule"
            labelSelector = {
              matchLabels = local.nginx_selector
            }
          }
        ]

        // We need to change these from the defaults
        // so that they are more responsive;
        // in particular, the readiness probe took way too
        // long in stopping incoming traffic
        livenessProbe = {
          failureThreshold = 3
          periodSeconds    = 10
        }
        readinessProbe = {
          failureThreshold = 1
          periodSeconds    = 1
        }

        // See https://medium.com/codecademy-engineering/kubernetes-nginx-and-zero-downtime-in-production-2c910c6a5ed8
        lifecycle = {
          preStop = {
            exec = {
              // The pod MUST not be killed prior to the deregistration delay elapsing or connections will be forwarded
              // to a non-existent / killed pod
              command = ["/bin/sh", "-c", "sleep ${local.deregistration_delay}; /usr/local/openresty/nginx/sbin/nginx -c /etc/nginx/nginx.conf -s quit; while pgrep -x nginx; do sleep 1; done"]
            }
          }
        }
        terminationGracePeriodSeconds = local.deregistration_delay + local.nginx_base_timeout * 3

        allowSnippetAnnotations = true
        priorityClassName       = module.constants.cluster_important_priority_class_name
        ingressClassResource = {
          enabled = true
          default = false
          name    = "nginx"
        }
        admissionWebhooks = {
          annotations = {
            "cert-manager.io/inject-ca-from" = "${local.namespace}/${local.webhook_secret}"
          }
          certificate = "/etc/nginx-ingress/tls.crt"
          key         = "/etc/nginx-ingress/tls.key"
          patch = {
            enabled = false
          }
        }
        resources = {
          requests = {
            cpu    = "200m"
            memory = "500M"
          }
        }
        extraVolumeMounts = [
          {
            mountPath = "/etc/nginx-ingress/tls.crt"
            subPath   = "tls.crt"
            name      = "webhook-cert"
            readOnly  = true
          },
          {
            mountPath = "/etc/nginx-ingress/tls.key"
            subPath   = "tls.key"
            name      = "webhook-cert"
            readOnly  = true
          }
        ]
      }
    })
  ]

  # TODO: re-enable this patch if we enable horizontal autoscaling in the future
  #  postrender {
  #    binary_path = "${path.module}/nginx_kustomize/kustomize.sh"
  #    args = [
  #      local.namespace,
  #      "ingress-nginx-controller",
  #      var.min_replicas,
  #      var.kube_config_context
  #    ]
  #  }

  timeout    = 30 * 60
  depends_on = [module.webhook_cert, helm_release.alb_controller]
}

resource "kubernetes_service" "nginx_healthcheck" {
  metadata {
    name      = "nginx-healthcheck"
    namespace = local.namespace
    labels    = module.nginx_labels.kube_labels
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 80
      target_port = "metrics"
      protocol    = "TCP"
    }
    selector = local.nginx_selector
  }
  depends_on = [helm_release.nginx_ingress]
}

resource "kubernetes_service" "nginx_status" {
  metadata {
    name      = "nginx-status"
    namespace = local.namespace
    labels    = module.nginx_labels.kube_labels
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 18080
      target_port = 18080
      protocol    = "TCP"
    }
    selector = local.nginx_selector
  }
  depends_on = [helm_release.nginx_ingress]
}

resource "kubernetes_manifest" "vpa_nginx" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "ingress-nginx-controller"
      namespace = local.namespace
      labels    = module.nginx_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "ingress-nginx-controller"
      }
    }
  }
}

/***********************************************
* Bastion
************************************************/

resource "kubernetes_service_account" "bastion" {
  metadata {
    name      = local.bastion_name
    namespace = local.namespace
    labels    = module.bastion_labels.kube_labels
  }
}

resource "kubernetes_secret" "bastion_ca" {
  metadata {
    name      = "${local.bastion_name}-ca"
    namespace = local.namespace
    labels    = module.bastion_labels.kube_labels
  }
  data = {
    "trusted-user-ca-keys.pem" = var.bastion_ca_keys
  }
}

// This doesn't get rotated so no need to use cert-manager
resource "tls_private_key" "host" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "kubernetes_secret" "bastion_host" {
  metadata {
    name      = "${local.bastion_name}-host"
    namespace = local.namespace
    labels    = module.bastion_labels.kube_labels
  }
  data = {
    id_rsa       = tls_private_key.host.private_key_openssh
    "id_rsa.pub" = tls_private_key.host.public_key_openssh
  }
}

module "bastion" {
  source          = "../../modules/kube_deployment"
  namespace       = module.namespace.namespace
  service_name    = local.bastion_name
  service_account = kubernetes_service_account.bastion.metadata[0].name

  min_replicas        = 2
  max_replicas        = 2
  tolerations         = module.constants.spot_node_toleration_helm
  priority_class_name = module.constants.cluster_important_priority_class_name

  containers = [
    {
      name    = "bastion"
      image   = var.bastion_image
      version = var.bastion_image_version
      command = [
        "/usr/sbin/sshd",
        "-D", // run in foreground
        "-e", // print logs to stderr
        "-o", "LogLevel=INFO",
        "-q", // Don't log connections (we do that at the NLB level and these logs are polluted by healthchecks)
        "-o", "TrustedUserCAKeys=/etc/ssh/vault/trusted-user-ca-keys.pem",
        "-o", "HostKey=/run/sshd/id_rsa",
        "-o", "PORT=${var.bastion_port}"
      ]
      run_as_root        = true                               // SSHD requires root to run
      linux_capabilities = ["SYS_CHROOT", "SETGID", "SETUID"] // capabilities to allow sshd's sandboxing functionality
      healthcheck_port   = var.bastion_port
      healthcheck_type   = "TCP"
    },
    // SSHD requires that root be the only
    // writer to /run/sshd and the private host key
    {
      name    = "permission-init"
      init    = true
      image   = var.bastion_image
      version = var.bastion_image_version
      command = [
        "/usr/bin/bash",
        "-c",
        "cp /etc/ssh/host/id_rsa /run/sshd/id_rsa && chmod -R 700 /run/sshd"
      ]
      run_as_root = true
    }
  ]

  secret_mounts = {
    "${kubernetes_secret.bastion_ca.metadata[0].name}"   = "/etc/ssh/vault"
    "${kubernetes_secret.bastion_host.metadata[0].name}" = "/etc/ssh/host"
  }

  tmp_directories = { "/run/sshd" = {} }
  mount_owner     = 0

  ports = {
    ssh = {
      service_port = var.bastion_port
      pod_port     = var.bastion_port
    }
  }

  vpa_enabled = var.vpa_enabled

  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}


resource "kubernetes_service" "bastion" {
  metadata {
    name      = "${local.bastion_name}-ingress"
    namespace = local.namespace
    labels    = module.bastion_labels.kube_labels
    annotations = merge(local.nlb_common_annotations, {
      "service.beta.kubernetes.io/aws-load-balancer-name" = "bastion",
      "external-dns.alpha.kubernetes.io/hostname"         = var.bastion_domain
    })
  }
  spec {
    type                    = "LoadBalancer"
    load_balancer_class     = "service.k8s.aws/nlb"
    external_traffic_policy = "Cluster"
    internal_traffic_policy = "Cluster"
    ip_families             = ["IPv4"]
    ip_family_policy        = "SingleStack"
    selector                = local.bastion_selector
    port {
      name        = "ssh"
      port        = var.bastion_port
      target_port = var.bastion_port
      protocol    = "TCP"
    }
  }
  depends_on = [module.bastion]
}
