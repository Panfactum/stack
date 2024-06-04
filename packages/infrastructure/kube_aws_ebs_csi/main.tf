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
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

locals {
  service   = "aws-ebs-csi-driver"
  namespace = module.namespace.namespace

  default_resources = {
    requests = {
      memory = "50Mi"
    }
    limits = {
      memory = "80Mi"
    }
  }
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "util_controller" {
  source                                = "../kube_workload_utility"
  workload_name                         = "ebs-csi-controller"
  burstable_nodes_enabled               = true
  instance_type_anti_affinity_preferred = true

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

/***************************************
* Namespace
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace = local.service

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
data "aws_region" "main" {}

resource "kubernetes_service_account" "ebs_csi" {
  metadata {
    name      = local.service
    namespace = local.namespace
    labels    = module.util_controller.labels
  }
}

data "aws_iam_policy_document" "extra_permissions" {
  statement {
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKeyWithoutPlaintext",
      "kms:CreateGrant"
    ]
    resources = ["*"]
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.ebs_csi.metadata[0].name
  service_account_namespace = kubernetes_service_account.ebs_csi.metadata[0].namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.extra_permissions.json
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

resource "aws_iam_role_policy_attachment" "default_permissions" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
  role       = module.aws_permissions.role_name
}

/***************************************
* CSI Driver
***************************************/

resource "helm_release" "ebs_csi_driver" {
  namespace       = local.namespace
  name            = local.service
  repository      = "https://kubernetes-sigs.github.io/aws-ebs-csi-driver"
  chart           = "aws-ebs-csi-driver"
  version         = var.aws_ebs_csi_driver_helm_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({

      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].ecr_public_registry : "public.ecr.aws"}/ebs-csi-driver/aws-ebs-csi-driver"
      }
      labels = module.util_controller.labels

      controller = {

        replicaCount              = 2
        tolerations               = module.util_controller.tolerations
        affinity                  = module.util_controller.affinity
        topologySpreadConstraints = module.util_controller.topology_spread_constraints
        serviceAccount = {
          create                       = false
          name                         = kubernetes_service_account.ebs_csi.metadata[0].name
          autoMountServiceAccountToken = true
        }
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        podLabels = module.util_controller.labels
        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }
        enableMetrics = var.monitoring_enabled
        serviceMonitor = {
          labels   = module.util_controller.labels
          interval = "60s"
        }
      }

      sidecars = {
        provisioner = {
          image = {
            repository = "${var.pull_through_cache_enabled ? module.pull_through[0].ecr_public_registry : "public.ecr.aws"}/eks-distro/kubernetes-csi/external-provisioner"
          }
          resources = local.default_resources
        }
        attacher = {
          image = {
            repository = "${var.pull_through_cache_enabled ? module.pull_through[0].ecr_public_registry : "public.ecr.aws"}/eks-distro/kubernetes-csi/external-attacher"
          }
          resources = local.default_resources
        }
        resizer = {
          image = {
            repository = "${var.pull_through_cache_enabled ? module.pull_through[0].ecr_public_registry : "public.ecr.aws"}/eks-distro/kubernetes-csi/external-resizer"
          }
          resources = local.default_resources
        }
        livenessProbe = {
          image = {
            repository = "${var.pull_through_cache_enabled ? module.pull_through[0].ecr_public_registry : "public.ecr.aws"}/eks-distro/kubernetes-csi/livenessprobe"
          }
          resources = local.default_resources
        }
        nodeDriverRegistrar = {
          image = {
            repository = "${var.pull_through_cache_enabled ? module.pull_through[0].ecr_public_registry : "public.ecr.aws"}/eks-distro/kubernetes-csi/node-driver-registrar"
          }
          resources = local.default_resources
        }
        volumemodifier = {
          image = {
            repository = "${var.pull_through_cache_enabled ? module.pull_through[0].ecr_public_registry : "public.ecr.aws"}/ebs-csi-driver/volume-modifier-for-k8s"
          }
          resources = local.default_resources
        }
        snapshotter = {
          forceEnable = true
          image = {
            repository = "${var.pull_through_cache_enabled ? module.pull_through[0].ecr_public_registry : "public.ecr.aws"}/eks-distro/kubernetes-csi/external-snapshotter/csi-snapshotter"
          }
          resources = local.default_resources
        }
      }

      node = {
        serviceAccount = {
          create                       = false
          name                         = kubernetes_service_account.ebs_csi.metadata[0].name
          autoMountServiceAccountToken = true
        }
        resources = local.default_resources
      }
    })
  ]
  depends_on = [module.aws_permissions]
}

/***************************************
* Storage Classes
***************************************/

resource "kubernetes_storage_class" "standard" {
  metadata {
    name = "ebs-standard"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = "true"
      "resize.topolvm.io/enabled"                   = "true"
    }
  }
  storage_provisioner    = "ebs.csi.aws.com"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true
  reclaim_policy         = "Delete"

  parameters = {
    type      = "gp3"
    encrypted = true
    tagSpecification_1 : "Name={{ .PVCNamespace }}/{{ .PVCName }}"
  }
}

resource "kubernetes_storage_class" "standard_retained" {
  metadata {
    name = "ebs-standard-retained"
    annotations = {
      "resize.topolvm.io/enabled" = "true"
    }
  }
  storage_provisioner    = "ebs.csi.aws.com"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true
  reclaim_policy         = "Retain"
  parameters = {
    type      = "gp3"
    encrypted = true
    tagSpecification_1 : "Name={{ .PVCNamespace }}/{{ .PVCName }}"
  }
}

/***************************************
* VPA
***************************************/

resource "kubernetes_manifest" "vpa_deployment" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "ebs-csi-driver-deployment"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "ebs-csi-controller"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_daemonset" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "ebs-csi-driver-daemonset"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "ebs-csi-node"
      }
    }
  }
}
