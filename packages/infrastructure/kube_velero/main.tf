terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
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
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  namespace    = module.namespace.namespace
  cluster_name = data.pf_metadata.metadata.kube_cluster_name
}

data "pf_kube_labels" "labels" {
  module = "kube_velero"
}
data "pf_metadata" "metadata" {}

data "aws_region" "current" {}

module "util" {
  source = "../kube_workload_utility"

  workload_name                        = "velero"
  burstable_nodes_enabled              = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false // single replica
  az_spread_preferred                  = false // single replica
  controller_nodes_required            = true  // we disable voluntary disruptions so this should be scheduled on a node that isn't autoscaled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = "velero"
}

/***************************************
* Storage Location
***************************************/

resource "random_id" "bucket_name" {
  prefix      = "${local.cluster_name}-backup-"
  byte_length = 8
}

module "backup_bucket" {
  source = "../aws_s3_private_bucket"

  bucket_name = random_id.bucket_name.hex
  description = "State backups for the ${local.cluster_name} cluster"

  intelligent_transitions_enabled = false
  timed_transitions_enabled       = false
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
    labels    = module.util.labels
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.velero.metadata[0].name
  service_account_namespace = local.namespace
  iam_policy_json           = data.aws_iam_policy_document.velero.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}


/***************************************
* VolumeSnapshotClass
***************************************/

resource "kubectl_manifest" "snapshot_class" {
  yaml_body = yamlencode({
    apiVersion = "snapshot.storage.k8s.io/v1"
    kind       = "VolumeSnapshotClass"
    metadata = {
      name = "velero"
      labels = merge(
        module.util.labels,
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
  })
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
  atomic          = true
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "velero"
      labels           = module.util.labels
      podLabels = merge(
        module.util.labels,
        {
          customizationHash = md5(join("", [
            for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
          ]))
        }
      )
      podAnnotations = {
        "karpenter.sh/do-not-disrupt" = "true"
      }

      initContainers = [
        {
          name            = "velero-plugin-for-aws"
          image           = "docker.io/velero/velero-plugin-for-aws:${var.aws_plugin_version}"
          imagePullPolicy = "IfNotPresent"
          volumeMounts = [
            {
              mountPath = "/target"
              name      = "plugins"
            }
          ]
        }
      ]

      cleanUpCRDs = true
      upgradeCRDs = true


      serviceAccount = {
        server = {
          create = false
          name   = kubernetes_service_account.velero.metadata[0].name
        }
      }

      affinity          = module.util.affinity
      priorityClassName = module.constants.cluster_important_priority_class_name
      tolerations       = module.util.tolerations

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

      metrics = {
        enabled        = var.monitoring_enabled
        scrapeInterval = "60s"
        serviceMonitor = {
          enabled = var.monitoring_enabled
        }
        prometheusRule = {
          enabled = var.monitoring_enabled
        }
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
          labels   = module.util.labels
          schedule = "0 * * * *"
          template = {
            snapshotVolumes = true // Only store snapshots for the last hour due to high costs
            ttl             = "1h30m0s"
            storageLocation = "s3"
            excludedResources = [

              // https://cert-manager.io/docs/devops-tips/backup/#example-backup-and-restore-using-velero
              "challenges.acme.cert-manager.io",
              "orders.acme.cert-manager.io",
              "certificaterequests.cert-manager.io"
            ]
          }
        }
      }
    })
  ]

  depends_on = [module.aws_permissions]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "velero-dashboard"
    labels = merge(module.util.labels, { "grafana_dashboard" = "1" })
  }
  data = {
    "velero.json" = file("${path.module}/dashboard.json")
  }
}


resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "velero"
      namespace = local.namespace
      labels    = module.util.labels
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
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "velero"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.velero]
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "velero"
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util.match_labels
      }
      maxUnavailable = 0
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.velero]
}

/***************************************
* VolumeSnapshot Garbage Collection
*
* If the Velero server is ever disrupted in the middle of taking a Backup,
* the VolumeSnapshots that were included in that Backup will be orphaned and
* never deleted. This will cause unbounded storage growth so we provide
* a custom mechanism to clean-up these orphaned snapshots that runs daily
***************************************/

resource "kubernetes_cluster_role" "snapshot_gc" {
  metadata {
    name   = "velero-snapshot-gc"
    labels = module.snapshot_gc.labels
  }
  rule {
    api_groups = ["snapshot.storage.k8s.io"]
    resources  = ["volumesnapshotcontents", "volumesnapshots"]
    verbs      = ["get", "update", "list", "patch", "delete"]
  }
}

resource "kubernetes_cluster_role_binding" "snapshot_gc" {
  metadata {
    name   = "velero-snapshot-gc"
    labels = module.snapshot_gc.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.snapshot_gc.service_account_name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.snapshot_gc.metadata[0].name
  }
}

module "snapshot_gc" {
  source = "../kube_cron_job"

  name                        = "velero-snapshot-gc"
  namespace                   = local.namespace
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  spot_nodes_enabled          = true
  arm_nodes_enabled           = true
  burstable_nodes_enabled     = true
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = "0 0 * * *"
  containers = [{
    name             = "garbage-collector"
    image_registry   = "public.ecr.aws"
    image_repository = module.constants.panfactum_image_repository
    image_tag        = module.constants.panfactum_image_tag
    command = [
      "/bin/pf-velero-snapshot-gc"
    ]
    minimum_memory = 50
  }]
  starting_deadline_seconds = 60 * 5
  active_deadline_seconds   = 60 * 5
}

