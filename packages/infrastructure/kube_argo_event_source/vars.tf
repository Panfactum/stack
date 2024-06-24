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
  default     = false
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
