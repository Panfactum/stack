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
  }
}

locals {
  namespace = module.namespace.namespace
  matching_labels = {
    id = random_id.controller_id.hex
  }
}

data "aws_region" "current" {}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

resource "random_id" "controller_id" {
  prefix      = "velero-"
  byte_length = 8
}

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, local.matching_labels)
}

module "constants" {
  source          = "../constants"
  environment     = var.environment
  matching_labels = local.matching_labels
  pf_root_module  = var.pf_root_module
  region          = var.region
  is_local        = var.is_local
  extra_tags      = var.extra_tags
}

module "namespace" {
  source         = "../kube_namespace"
  namespace      = "velero"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

/***************************************
* Storage Location
***************************************/

resource "random_id" "bucket_name" {
  prefix      = "${var.eks_cluster_name}-backup-"
  byte_length = 8
}

module "backup_bucket" {
  source = "../aws_s3_private_bucket"

  bucket_name = random_id.bucket_name.hex
  description = "State backups for the  ${var.eks_cluster_name} cluster"

  intelligent_transitions_enabled = false
  timed_transitions_enabled       = false

  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

/***************************************
* Permissions
***************************************/
data "aws_iam_policy_document" "velero" {
  statement {
    sid    = "EBS"
    effect = "Allow"
    actions = [
      "ec2:DescribeVolumes",
      "ec2:DescribeSnapshots",
      "ec2:CreateTags",
      "ec2:CreateVolume",
      "ec2:CreateSnapshot",
      "ec2:DeleteSnapshots"
    ]
    resources = ["*"]
  }
  statement {
    sid    = "StoreBackups"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:PutObject",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts"
    ]
    resources = ["${module.backup_bucket.bucket_arn}/*"]
  }
  statement {
    sid    = "ListBuckets"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
    ]
    resources = [module.backup_bucket.bucket_arn]
  }
}

resource "kubernetes_service_account" "velero" {
  metadata {
    name      = "velero"
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
}

module "aws_permissions" {
  source                    = "../kube_sa_auth_aws"
  service_account           = kubernetes_service_account.velero.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.velero.json
  ip_allow_list             = var.ip_allow_list
  environment               = var.environment
  pf_root_module            = var.pf_root_module
  region                    = var.region
  is_local                  = var.is_local
}


/***************************************
* VolumeSnapshotClass
***************************************/

resource "kubernetes_manifest" "snapshot_class" {
  manifest = {
    apiVersion = "snapshot.storage.k8s.io/v1"
    kind       = "VolumeSnapshotClass"
    metadata = {
      name = "default"
      labels = merge(
        module.kube_labels.kube_labels,
        {
          "velero.io/csi-volumesnapshot-class" = "true"
        }
      )
      annotations = {
        "snapshot.storage.kubernetes.io/is-default-class" = "true"
      }
    }
    driver         = "ebs.csi.aws.com"
    deletionPolicy = "Retain"
    parameters = {
      tagSpecification_1 = "Namespace={{ .VolumeSnapshotNamespace }}"
      tagSpecification_2 = "Name={{ .VolumeSnapshotName }}"
      tagSpecification_3 = "ContentName={{ .VolumeSnapshotContentName }}"
    }
  }
}

/***************************************
* Velero
***************************************/

resource "helm_release" "velero" {
  namespace       = local.namespace
  name            = "velero"
  repository      = "https://vmware-tanzu.github.io/helm-charts"
  chart           = "velero"
  version         = var.velero_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      fullnameOverride = "velero"
      labels           = module.kube_labels.kube_labels
      podLabels        = module.kube_labels.kube_labels
      podAnnotations = {
        "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
      }


      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/velero/velero"
      }

      initContainers = [
        {
          name            = "velero-plugin-for-aws"
          image           = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/velero/velero-plugin-for-aws:${var.aws_plugin_version}"
          imagePullPolicy = "IfNotPresent"
          volumeMounts = [
            {
              mountPath = "/target"
              name      = "plugins"
            }
          ]
        },
        {
          name            = "velero-plugin-for-csi"
          image           = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/velero/velero-plugin-for-csi:${var.csi_plugin_version}"
          imagePullPolicy = "IfNotPresent"
          volumeMounts = [
            {
              mountPath = "/target"
              name      = "plugins"
            }
          ]
        }
      ]

      kubectl = {
        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/bitnami/kubectl"
        }
        annotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
      }
      cleanUpCRDs = true
      upgradeCRDs = true


      serviceAccount = {
        server = {
          create = false
          name   = kubernetes_service_account.velero.metadata[0].name
        }
      }


      priorityClassName = module.constants.cluster_important_priority_class_name

      resources = {
        requests = {
          memory = "256Mi"
          cpu    = "100m"
        }
        // We should allow a significant overage as this will only be hit in a disaster recovery scenario
        limits = {
          memory = "512Mi"
          cpu    = "10000m"
        }
      }

      credentials = {
        useSecret = false // required to use IRSA
      }

      configuration = {
        backupStorageLocation = [{
          name       = "s3"
          provider   = "velero.io/aws"
          accessMode = "ReadWrite"
          bucket     = module.backup_bucket.bucket_name
          default    = true
          config = {
            region = data.aws_region.current.name
          }
        }]
        volumeSnapshotLocation = [{
          provider = "velero.io/aws"
          config = {
            region = data.aws_region.current.name
          }
        }]
        defaultBackupStorageLocation   = "s3"
        defaultVolumeSnapshotLocations = "velero.io/aws:s3"
        garbageCollectionFrequency     = "5m"
        logFormat                      = "json"
        logLevel                       = var.log_level
        namespace                      = local.namespace
        features                       = "EnableCSI"

      }

      schedules = {
        hourly = {
          disabled = false
          labels   = module.kube_labels.kube_labels
          schedule = "0 * * * *"
          template = {
            snapshotVolumes = true // Only store snapshots for the last hour due to high costs
            ttl             = "1h30m0s"
            storageLocation = "s3"
          }
        }
        daily = {
          disabled = false
          labels   = module.kube_labels.kube_labels
          schedule = "0 0 * * *"
          template = {
            snapshotVolumes = false
            ttl             = "${24 * 7}h0m0s"
            storageLocation = "s3"
          }
        }
      }
    })
  ]

  depends_on = [module.aws_permissions]
}

resource "kubernetes_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "velero"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "velero"
          minAllowed = {
            memory = "256Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "velero"
      }
    }
  }
  depends_on = [helm_release.velero]
}

resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "velero"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.matching_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.velero]
}