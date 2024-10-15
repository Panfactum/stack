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
      version = "5.70.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
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

data "pf_kube_labels" "labels" {
  module = "kube_alloy"
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                 = "ebs-csi-controller"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  extra_labels                  = data.pf_kube_labels.labels.labels
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
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({

      image = {
        repository = "${module.pull_through.ecr_public_registry}/ebs-csi-driver/aws-ebs-csi-driver"
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
        podLabels = merge(
          {
            customizationHash = md5(join("", [for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)]))
          },
          module.util_controller.labels
        )
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
            repository = "${module.pull_through.ecr_public_registry}/eks-distro/kubernetes-csi/external-provisioner"
          }
          resources = local.default_resources
        }
        attacher = {
          image = {
            repository = "${module.pull_through.ecr_public_registry}/eks-distro/kubernetes-csi/external-attacher"
          }
          resources = local.default_resources
        }
        resizer = {
          image = {
            repository = "${module.pull_through.ecr_public_registry}/eks-distro/kubernetes-csi/external-resizer"
          }
          resources = local.default_resources
        }
        livenessProbe = {
          image = {
            repository = "${module.pull_through.ecr_public_registry}/eks-distro/kubernetes-csi/livenessprobe"
          }
          resources = local.default_resources
        }
        nodeDriverRegistrar = {
          image = {
            repository = "${module.pull_through.ecr_public_registry}/eks-distro/kubernetes-csi/node-driver-registrar"
          }
          resources = local.default_resources
        }
        volumemodifier = {
          image = {
            repository = "${module.pull_through.ecr_public_registry}/ebs-csi-driver/volume-modifier-for-k8s"
          }
          resources = local.default_resources
        }
        snapshotter = {
          forceEnable = true
          image = {
            repository = "${module.pull_through.ecr_public_registry}/eks-distro/kubernetes-csi/external-snapshotter/csi-snapshotter"
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
        resources         = local.default_resources
        tolerateAllTaints = false // This prevents nodes from being shutdown in a timely manner
        tolerations = concat(
          [
            // This is required b/c otherwise storage won't be detached during node shutdown
            {
              key      = "karpenter.sh/disruption"
              operator = "Exists"
              effect   = "NoSchedule"
            },
            {
              key      = "karpenter.sh/disrupted" // Karpenter docs are wrong; this needs to be tolerated as well
              operator = "Exists"
              effect   = "NoSchedule"
            },

            // These are required b/c storage binding should never be disabled, even under resource pressure
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
          module.util_controller.tolerations
        )
      }
    })
  ]

  // (1) We need to extend the termination grace period seconds for the daemonset pods
  // to allow time for all other pods on the node to terminate as the
  // ebs pod has to be the last one to terminate in order to detach the ebs volumes
  // (2) We need to remove the default podAntiAffinity rules from the deployment
  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
    args        = [var.panfactum_scheduler_enabled ? module.constants.panfactum_scheduler_name : "default-scheduler"]
  }

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
    tagSpecification_2 : "panfactum.com/storageclass=ebs-standard"
    allowAutoIOPSPerGBIncrease = true
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
    tagSpecification_2 : "panfactum.com/storageclass=ebs-standard-retained"
    allowAutoIOPSPerGBIncrease = true
  }
}


resource "kubernetes_storage_class" "extra" {
  for_each = var.extra_storage_classes
  metadata {
    name = each.key
    annotations = {
      "resize.topolvm.io/enabled" = "true"
    }
  }
  storage_provisioner    = "ebs.csi.aws.com"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true
  reclaim_policy         = each.value.reclaim_policy
  parameters = { for k, v in {
    type      = each.value.type
    encrypted = true
    tagSpecification_1 : "Name={{ .PVCNamespace }}/{{ .PVCName }}"
    tagSpecification_2 : "panfactum.com/storageclass=${each.key}"
    allowAutoIOPSPerGBIncrease = true
    iops                       = each.value.iops
    iopsPerGB                  = each.value.iops_per_gb
    throughput                 = each.value.throughput
    blockExpress               = each.value.type == "io2" ? each.value.block_express : null
    blockSize                  = each.value.block_size
    inodeSize                  = each.value.inode_size
    bytes_per_inode            = each.value.bytes_per_inode
    numberOfInodes             = each.value.number_of_inodes
    ext4BigAlloc               = each.value.big_alloc
    ext4ClusterSize            = each.value.cluster_size
  } : k => v if v != null }
}

/***************************************
* VPA
***************************************/

resource "kubectl_manifest" "vpa_deployment" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
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
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.ebs_csi_driver]
}

resource "kubectl_manifest" "vpa_daemonset" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
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
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.ebs_csi_driver]
}
