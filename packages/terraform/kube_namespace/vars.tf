variable "namespace" {
  description = "The name of the kubernetes namespace to instantiate."
  type        = string
}

variable "linkerd_inject" {
  description = "Whether to inject linkerd sidecars into pods in this namespace."
  type        = bool
  default     = true
}

variable "admin_groups" {
  description = "The names of the kubernetes groups to give admin access to the namespace."
  type        = list(string)
  default     = ["system:admins"]
}

variable "reader_groups" {
  description = "The names of the kubernetes groups to give read access to the namespace."
  type        = list(string)
  default     = ["system:readers"]
}

variable "bot_reader_groups" {
  description = "The names of the kubernetes groups to give elevated read access to the namespace."
  type        = list(string)
  default     = ["system:bot-readers"]
}

variable "loadbalancer_enabled" {
  description = "Whether the namespace is going to create LoadBalancer services"
  type        = bool
  default     = false
}