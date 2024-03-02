variable "namespace" {
  description = "The namespace the cluster is in"
  type        = string
}

variable "ingress_name" {
  description = "The name prefix of the ingresses that will get created"
  type        = string
}

variable "ingress_configs" {
  description = "A list of ingress names to the configuration to use for the ingress"
  type = list(object({

    # THis ingress matches all incoming requests on the indicated domains that have the indicated path prefixes
    domains       = list(string)
    path_prefix   = optional(string, "/")
    remove_prefix = optional(bool, false) # True iff the the path_prefix should be stripped before forwarding on to upstream service

    # The backing Kubernetes service
    service      = string
    service_port = number

    # Allows redirecting a subset of traffic to a different service;
    # For use in migrating functionality between services
    rewrite_rules = optional(list(object({
      path_regex   = string # A regex to match against incoming paths
      path_rewrite = string # The new path to use
    })), [])
  }))
}

variable "enable_ratelimiting" {
  description = "Whether to enable ratelimiting"
  type        = bool
  default     = true
}
