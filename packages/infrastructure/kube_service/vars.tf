variable "namespace" {
  description = "The namespace the Service will be created in."
  type        = string
}

variable "name" {
  description = "The name of this Service"
  type        = string
}

variable "ports" {
  description = "The port configuration. Keys are the port names, and the values are the port configuration."
  type = map(object({
    pod_port     = number                  # Port on the backing pods that traffic should be routed to
    service_port = optional(number, null)  # Port to expose on the service. defaults to pod_port
    protocol     = optional(string, "TCP") # One of TCP, UDP, or SCTP
  }))
  default = {}
}

variable "service_ip" {
  description = "If provided, the service will be statically bound to this IP address. Must be within the Service IP CIDR range for the cluster."
  type        = string
  default     = null
}

variable "match_labels" {
  description = "The label selector to use for pods backing the Service"
  type        = map(string)
}

variable "headless_enabled" {
  description = "Set to true iff setting up a StatefulSet headless service."
  type        = bool
  default     = false
}

variable "extra_annotations" {
  description = "Extra annotations to add to the Service."
  type        = map(string)
  default     = {}
}

variable "extra_labels" {
  description = "Extra labels to add to the Service."
  type        = map(string)
  default     = {}
}

variable "internal_traffic_policy" {
  description = "The InternalTrafficPolicy of the Service."
  type        = string
  default     = "Cluster"

  validation {
    condition     = contains(["Cluster", "Local"], var.internal_traffic_policy)
    error_message = "Must be one of: Cluster, Local"
  }
}

variable "external_traffic_policy" {
  description = "The ExternalTrafficPolicy of the Service."
  type        = string
  default     = "Cluster"

  validation {
    condition     = contains(["Cluster", "Local"], var.external_traffic_policy)
    error_message = "Must be one of: Cluster, Local"
  }
}

variable "type" {
  description = "The type of the Service."
  type        = string
  default     = "ClusterIP"

  validation {
    condition     = contains(["ExternalName", "ClusterIP", "NodePort", "LoadBalancer"], var.type)
    error_message = "Must be one of: ExternalName, ClusterIP, NodePort, LoadBalancer"
  }
}

variable "load_balancer_class" {
  description = "Iff type == LoadBalancer, the loadBalancerClass to use."
  type        = string
  default     = "service.k8s.aws/nlb"
}

variable "public_domain_names" {
  description = "Iff type == LoadBalancer, the public domains names that this service will be accessible from."
  type        = list(string)
  default     = []
}