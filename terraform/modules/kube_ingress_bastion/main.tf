// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.0.4"
    }
  }
}

locals {

  name = "bastion"
  namespace    = module.namespace.namespace

  bastion_selector = {
    module = var.module
  }

  // Number of seconds it takes to de-register targets from the NLB
  // (even though you can set this to < 5 minutes, there appears to be a consistent floor of about 5 minutes)
  // https://github.com/kubernetes-sigs/aws-load-balancer-controller/issues/2366#issuecomment-1118312709
  deregistration_delay = 60

  // TODO: Modularize since used in Nginx Ingress
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

module "labels" {
  source = "../../modules/kube_labels"
  additional_labels = {}
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
  loadbalancer_enabled = true
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***********************************************
* Bastion
************************************************/

resource "kubernetes_service_account" "bastion" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.labels.kube_labels
  }
}

resource "kubernetes_secret" "bastion_ca" {
  metadata {
    name      = "${local.name}-ca"
    namespace = local.namespace
    labels    = module.labels.kube_labels
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
    name      = "${local.name}-host"
    namespace = local.namespace
    labels    = module.labels.kube_labels
  }
  data = {
    id_rsa       = tls_private_key.host.private_key_openssh
    "id_rsa.pub" = tls_private_key.host.public_key_openssh
  }
}

module "bastion" {
  source          = "../../modules/kube_deployment"
  namespace       = module.namespace.namespace
  service_name    = local.name
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

resource "random_id" "bastion_name" {
  byte_length = 8
  prefix      = "bastion-"
}

resource "kubernetes_service" "bastion" {
  metadata {
    name      = "${local.name}-ingress"
    namespace = local.namespace
    labels    = module.labels.kube_labels
    annotations = merge(local.nlb_common_annotations, {
      "service.beta.kubernetes.io/aws-load-balancer-name" = random_id.bastion_name.hex,
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
