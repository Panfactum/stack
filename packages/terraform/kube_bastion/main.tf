// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.0.5"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
  }
}

locals {

  name      = "bastion"
  namespace = module.namespace.namespace

  // Number of seconds it takes to de-register targets from the NLB
  // (even though you can set this to < 5 minutes, there appears to be a consistent floor of about 5 minutes)
  // https://github.com/kubernetes-sigs/aws-load-balancer-controller/issues/2366#issuecomment-1118312709
  deregistration_delay = 60
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

module "constants" {
  source         = "../constants"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

module "namespace" {
  source               = "../kube_namespace"
  namespace            = local.name
  linkerd_inject       = false
  loadbalancer_enabled = true
  environment          = var.environment
  pf_root_module       = var.pf_root_module
  region               = var.region
  is_local             = var.is_local
  extra_tags           = var.extra_tags
}

/***************************************
* SSH Signing (Bastion Authentication)
***************************************/

resource "vault_mount" "ssh" {
  path                      = "ssh"
  type                      = "ssh"
  description               = "Configured to sign ssh keys for bastion authentication"
  default_lease_ttl_seconds = var.ssh_cert_lifetime_seconds
  max_lease_ttl_seconds     = var.ssh_cert_lifetime_seconds
}

resource "vault_ssh_secret_backend_ca" "ssh" {
  backend              = vault_mount.ssh.path
  generate_signing_key = true
}

resource "vault_ssh_secret_backend_role" "ssh" {
  backend  = vault_mount.ssh.path
  key_type = "ca"
  name     = "default"

  // For users, not hosts
  allow_user_certificates = true
  allow_host_certificates = false

  // Only allow high security ciphers
  algorithm_signer = "rsa-sha2-512"
  allowed_user_key_config {
    lengths = [0]
    type    = "ed25519"
  }

  // We only do port forwarding through the bastions
  default_extensions = {
    permit-port-forwarding = ""
  }
  allowed_extensions = "permit-port-forwarding"

  // Everyone must login with the panfactum user
  allowed_users = "panfactum"
  default_user  = "panfactum"

  // They are only valid for a single day
  ttl     = var.ssh_cert_lifetime_seconds
  max_ttl = var.ssh_cert_lifetime_seconds
}

/***********************************************
* Bastion Deployment
************************************************/

module "nlb_common" {
  source = "../kube_nlb_common_resources"

  name_prefix = "bastion-"

  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

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
    "trusted-user-ca-keys.pem" = vault_ssh_secret_backend_ca.ssh.public_key
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
  source          = "../kube_deployment"
  namespace       = module.namespace.namespace
  service_name    = local.name
  service_account = kubernetes_service_account.bastion.metadata[0].name

  min_replicas        = 2
  max_replicas        = 2
  tolerations         = module.constants.burstable_node_toleration_helm
  priority_class_name = module.constants.cluster_important_priority_class_name
  pod_annotations = {
    "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
  }

  // https://superuser.com/questions/1547888/is-sshd-hard-coded-to-require-root-access
  // SSHD requires root to run unfortunately. However, we drop all capability except
  // for its ability to sandbox users who connect.
  // I believe this is the maximum possible security if you want to use the standard unpatched sshd server
  containers = [
    {
      name    = "bastion"
      image   = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/panfactum/bastion"
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
      run_as_root        = true
      linux_capabilities = ["SYS_CHROOT", "SETGID", "SETUID"]
      healthcheck_port   = var.bastion_port
      healthcheck_type   = "TCP"
      minimum_memory     = 10
    },

    // SSHD requires that root be the only
    // writer to /run/sshd and the private host key
    {
      name    = "permission-init"
      init    = true
      image   = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/panfactum/bastion"
      version = var.bastion_image_version
      command = [
        "/usr/bin/bash",
        "-c",
        "cp /etc/ssh/host/id_rsa /run/sshd/id_rsa && chmod -R 700 /run/sshd"
      ]
      run_as_root    = true
      minimum_memory = 10
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

  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
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
    annotations = merge(module.nlb_common.annotations, {
      "external-dns.alpha.kubernetes.io/hostname" = join(",", var.bastion_domains)
    })
  }
  spec {
    type                    = "LoadBalancer"
    load_balancer_class     = "service.k8s.aws/nlb"
    external_traffic_policy = "Cluster"
    internal_traffic_policy = "Cluster"
    ip_families             = ["IPv4"]
    ip_family_policy        = "SingleStack"
    selector                = module.bastion.match_labels
    port {
      name        = "ssh"
      port        = var.bastion_port
      target_port = var.bastion_port
      protocol    = "TCP"
    }
  }
  depends_on = [module.bastion]
}
