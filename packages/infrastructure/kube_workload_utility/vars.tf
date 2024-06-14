variable "match_labels" {
  description = "kubernetes labels to use in selectors to match the workload"
  type        = map(string)
  default     = null
}

variable "workload_name" {
  description = "The name of the workload. Used by observability platform for grouping pods."
  type        = string
  default     = null
}

variable "topology_spread_enabled" {
  description = "Whether to enable topology spread constraints"
  type        = bool
  default     = true
}

variable "topology_spread_strict" {
  description = "Whether the topology spread constraint should be set to DoNotSchedule"
  type        = bool
  default     = false
}

variable "lifetime_evictions_enabled" {
  description = "Whether to allow pods to be evicted after exceeding a certain age (configured by descheduler)"
  type        = bool
  default     = true
}

variable "controller_node_required" {
  description = "Whether the pods must be scheduled on a controller node"
  type        = bool
  default     = false
}

variable "prefer_spot_nodes_enabled" {
  description = "Whether pods will prefer scheduling on spot nodes"
  type        = bool
  default     = false
}

variable "prefer_burstable_nodes_enabled" {
  description = "Whether pods will prefer scheduling on burstable nodes"
  type        = bool
  default     = false
}

variable "prefer_arm_nodes_enabled" {
  description = "Whether pods will prefer scheduling on arm64 nodes"
  type        = bool
  default     = false
}

variable "spot_nodes_enabled" {
  description = "Whether to allow pods to schedule on spot nodes"
  type        = bool
  default     = false
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow pods to schedule on burstable nodes"
  type        = bool
  default     = false
}

variable "arm_nodes_enabled" {
  description = "Whether to allow pods to schedule on arm64 nodes"
  type        = bool
  default     = false
}

variable "extra_tolerations" {
  description = "Extra tolerations to add to the pods"
  type = list(object({
    key      = optional(string)
    operator = string
    value    = optional(string)
    effect   = optional(string)
  }))
  default = []
}

variable "instance_type_anti_affinity_required" {
  description = "Whether to prevent pods from being scheduled on the same instance types"
  type        = bool
  default     = false
}

variable "zone_anti_affinity_required" {
  description = "Whether to prevent pods from being scheduled on the same zone"
  type        = bool
  default     = false
}

variable "instance_type_anti_affinity_preferred" {
  description = "Whether to prefer preventing pods from being scheduled on the same instance types"
  type        = bool
  default     = false
}

variable "host_anti_affinity_required" {
  description = "Whether to prefer preventing pods from being scheduled on the same host"
  type        = bool
  default     = true
}

variable "pod_affinity_match_labels" {
  description = "Labels to match for pod affinity"
  type        = map(string)
  default     = {}
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}