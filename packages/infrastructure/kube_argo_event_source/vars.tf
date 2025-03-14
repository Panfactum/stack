variable "name" {
  description = "The name of the Sensor"
  type        = string
}

variable "namespace" {
  description = "The namespace to deploy the Sensor into."
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "event_bus_name" {
  description = "The EventBus to read from. Should almost always be 'default'."
  type        = string
  default     = "default"
}

variable "event_source_spec" {
  description = "The specification of the EventSource. See https://github.com/argoproj/argo-events/blob/master/api/event-source.md#eventsourcespec"
  type        = any
}

variable "replicas" {
  description = "The number of replicas to run in the underlying deployment. Read this before changing the defaults: https://argoproj.github.io/argo-events/eventsources/ha/. Do NOT mix active-active and active-passive if using more than one replica."
  type        = number
  default     = 1
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "spot_nodes_enabled" {
  description = "Whether to allow pods to schedule on spot nodes"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow pods to schedule on burstable nodes"
  type        = bool
  default     = true
}

variable "controller_nodes_enabled" {
  description = "Whether to allow pods to schedule on EKS Node Group nodes (controller nodes)"
  type        = bool
  default     = true
}

variable "instance_type_anti_affinity_required" {
  description = "Whether to enable anti-affinity to prevent pods from being scheduled on the same instance type"
  type        = bool
  default     = true
}

variable "az_spread_preferred" {
  description = "Whether to enable topology spread constraints to spread pods across availability zones (with ScheduleAnyways)"
  type        = bool
  default     = true
}
