locals {
  eviction_hard_memory_available              = "5%"
  eviction_hard_nodefs_available              = "10%"
  eviction_hard_inodes_free                   = "10%"
  eviction_soft_memory_available              = "10%"
  eviction_soft_nodefs_available              = "15%"
  eviction_soft_inodes_free                   = "15%"
  eviction_soft_grace_period_memory_available = "2m0s"
  eviction_soft_grace_period_nodefs_available = "2m0s"
  eviction_soft_grace_period_inodes_free      = "2m0s"
  image_gc_high_threshold_percent             = "85"
  image_gc_low_threshold_percent              = "80"
  shutdown_grace_period                       = var.is_spot ? "2m0s" : "60m0s"
  shutdown_grace_period_for_critical_pods     = var.is_spot ? "1m0s" : "5m0s"
  user_data = templatefile("${path.module}/user-data.toml", {
    API_SERVER_ADDR                             = var.cluster_endpoint
    CLUSTER_CA_DATA                             = var.cluster_ca_data
    CLUSTER_NAME                                = var.cluster_name
    MAX_PODS                                    = var.max_pods
    KUBE_RESERVED_MEMORY                        = 150 + (8 * var.max_pods)
    SHUTDOWN_GRACE_PERIOD                       = local.shutdown_grace_period
    SHUTDOWN_GRACE_PERIOD_FOR_CRITICAL_PODS     = local.shutdown_grace_period_for_critical_pods
    IMAGE_GC_HIGH_THRESHOLD_PERCENT             = local.image_gc_high_threshold_percent
    IMAGE_GC_LOW_THRESHOLD_PERCENT              = local.image_gc_low_threshold_percent
    EVICTION_HARD_MEMORY_AVAILABLE              = local.eviction_hard_memory_available
    EVICTION_HARD_NODEFS_AVAILABLE              = local.eviction_hard_nodefs_available
    EVICTION_HARD_INODES_FREE                   = local.eviction_hard_inodes_free
    EVICTION_SOFT_MEMORY_AVAILABLE              = local.eviction_soft_memory_available
    EVICTION_SOFT_NODEFS_AVAILABLE              = local.eviction_soft_nodefs_available
    EVICTION_SOFT_INODES_FREE                   = local.eviction_soft_inodes_free
    EVICTION_SOFT_GRACE_PERIOD_MEMORY_AVAILABLE = local.eviction_soft_grace_period_memory_available
    EVICTION_SOFT_GRACE_PERIOD_NODEFS_AVAILABLE = local.eviction_soft_grace_period_nodefs_available
    EVICTION_SOFT_GRACE_PERIOD_INODES_FREE      = local.eviction_soft_grace_period_inodes_free
  })
}
