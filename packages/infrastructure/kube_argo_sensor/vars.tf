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

variable "dependencies" {
  description = "A list of events that can activate triggers on the sensor"
  type = list(object({
    name                   = string
    eventSourceName        = string
    eventName              = optional(string, "default")
    filtersLogicalOperator = optional(string, "and")
    filters = optional(object({
      dataLogicalOperator = optional(string, "and")
      exprLogicalOperator = optional(string, "and")
      script              = optional(string)
      time = optional(object({
        start = string
        stop  = string
      }))
      context = optional(object({
        id              = string
        source          = optional(string)
        specversion     = optional(string)
        type            = optional(string)
        datacontenttype = optional(string)
        subject         = optional(string)
        time            = optional(string)
      }))
      data = optional(list(object({
        path       = string
        type       = string
        value      = list(string)
        comparator = optional(string, "=")
        template   = optional(string)
      })))
      exprs = optional(list(object({
        expr = string
        fields = list(object({
          path = string
          name = string
        }))
      })))
    }))
  }))
}

variable "triggers" {
  description = "A list of actions that can be triggered by events from the EventBus"
  type        = any # Left as any b/c this can be extended by the user
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}
