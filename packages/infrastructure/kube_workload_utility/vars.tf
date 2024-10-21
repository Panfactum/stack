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

variable "az_spread_preferred" {
  description = "Whether to enable topology spread constraints to spread pods across availability zones (with ScheduleAnyways)"
  type        = bool
  default     = true
}

variable "az_spread_required" {
  description = "Whether to enable topology spread constraints to spread pods across availability zones (with DoNotSchedule)"
  type        = bool
  default     = false
}

variable "az_anti_affinity_required" {
  description = "Whether to prevent pods from being scheduled in the same availability zone"
  type        = bool
  default     = false
}

variable "lifetime_evictions_enabled" {
  description = "Whether to allow pods to be evicted after exceeding a certain age (configured by Descheduler)"
  type        = bool
  default     = true
}

variable "controller_nodes_required" {
  description = "Whether the pods must be scheduled on an EKS Node Group node"
  type        = bool
  default     = false
}

variable "node_requirements" {
  description = "Node label requirements for the pods"
  type        = map(list(string))
  default     = {}
}

variable "node_preferences" {
  description = "Node label preferences for the pods"
  type        = map(object({ weight = number, operator = string, values = list(string) }))
  default     = {}
}

variable "spot_nodes_enabled" {
  description = "Whether to allow pods to schedule on spot nodes"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow pods to schedule on burstable nodes"
  type        = bool
  default     = false
}

variable "arm_nodes_enabled" {
  description = "Whether to allow pods to schedule on arm64 nodes"
  type        = bool
  default     = true
}

variable "controller_nodes_enabled" {
  description = "Whether to allow pods to schedule on EKS Node Group nodes (controller nodes)"
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
  description = "Whether to enable anti-affinity to prevent pods from being scheduled on the same instance type"
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

variable "extra_labels" {
  description = "Extra labels to add to the workload"
  type        = map(string)
  default     = {}
}
