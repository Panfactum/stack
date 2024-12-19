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
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
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
  module = "kube_aws_ebs_csi"
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "ebs-csi-controller"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  instance_type_anti_affinity_required = false // Will prevent bootstrapping and simply unnecessary
  az_spread_preferred                  = var.sla_target == 3
  host_anti_affinity_required          = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
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

      labels = module.util_controller.labels

      controller = {

        replicaCount              = var.sla_target == 3 ? 2 : 1
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
          resources = local.default_resources
        }
        attacher = {
          resources = local.default_resources
        }
        resizer = {
          resources = local.default_resources
        }
        livenessProbe = {
          resources = local.default_resources
        }
        nodeDriverRegistrar = {
          resources = local.default_resources
        }
        volumemodifier = {
          resources = local.default_resources
        }
        snapshotter = {
          forceEnable = true
          resources   = local.default_resources
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
        volumes = [
          {
            name = "selinuxfs"
            hostPath = {
              path = "/sys/fs/selinux"
              type = "Directory"
            }
          },
          {
            name = "selinux-config"
            hostPath = {
              path = "/etc/selinux/config"
              type = "FileOrCreate"
            }
          }
        ]
        volumeMounts = [
          {
            name      = "selinuxfs"
            mountPath = "/sys/fs/selinux"
          },
          {
            name      = "selinux-config"
            mountPath = "/etc/selinux/config"
          },
        ]
      }
    })
  ]

  // (1) We need to extend the termination grace period seconds for the daemonset pods
  // to allow time for all other pods on the node to terminate as the
  // ebs pod has to be the last one to terminate in order to detach the ebs volumes
  // (2) We need to remove the default podAntiAffinity rules from the deployment
  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
  }

  depends_on = [module.aws_permissions]
}

// This improves node startup time performance
module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [
    {
      registry    = "public.ecr.aws"
      repository  = "ebs-csi-driver/aws-ebs-csi-driver"
      tag         = "v1.37.0"
      pin_enabled = false
    },
    {
      registry    = "public.ecr.aws"
      repository  = "eks-distro/kubernetes-csi/livenessprobe"
      tag         = "v2.14.0-eks-1-31-7"
      pin_enabled = false
    },
    {
      registry    = "public.ecr.aws"
      repository  = "eks-distro/kubernetes-csi/node-driver-registrar"
      tag         = "v2.12.0-eks-1-31-7"
      pin_enabled = false
    }
  ]
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

  mount_options = [
    "context=\"system_u:object_r:local_t:s0\""
  ]
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

  mount_options = [
    "context=\"system_u:object_r:local_t:s0\""
  ]
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

  mount_options = [
    "context=\"system_u:object_r:local_t:s0\""
  ]
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
