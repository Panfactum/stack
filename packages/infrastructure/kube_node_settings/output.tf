output "eviction_hard_memory_available" {
  value = local.eviction_hard_memory_available
}
output "eviction_hard_nodefs_available" {
  value = local.eviction_hard_nodefs_available
}
output "eviction_hard_inodes_free" {
  value = local.eviction_hard_inodes_free
}
output "eviction_soft_memory_available" {
  value = local.eviction_soft_memory_available
}
output "eviction_soft_nodefs_available" {
  value = local.eviction_soft_nodefs_available
}
output "eviction_soft_inodes_free" {
  value = local.eviction_soft_inodes_free
}
output "eviction_soft_grace_period_memory_available" {
  value = local.eviction_soft_grace_period_memory_available
}
output "eviction_soft_grace_period_nodefs_available" {
  value = local.eviction_soft_grace_period_nodefs_available
}
output "eviction_soft_grace_period_inodes_free" {
  value = local.eviction_soft_grace_period_inodes_free
}
output "image_gc_high_threshold_percent" {
  value = local.image_gc_high_threshold_percent
}
output "image_gc_low_threshold_percent" {
  value = local.image_gc_low_threshold_percent
}
output "shutdown_grace_period" {
  value = local.shutdown_grace_period
}
output "user_data" {
  value = local.user_data
}
