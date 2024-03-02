variable "nginx_ingress_version" {
  description = "The version of nginx-ingress to deploy"
  type        = string
  default     = "v1.8.1"
}

variable "nginx_ingress_helm_version" {
  description = "The version of the nginx-ingress helm chart to deploy"
  type        = string
  default     = "4.7.1"
}

variable "max_replicas" {
  description = "The maximum number of nginx-ingress replicas to deploy"
  type        = number
  default     = 10
}

variable "min_replicas" {
  description = "The minimum number of nginx-ingress replicas to deploy"
  type        = number
  default     = 2
}

variable "dhparam" {
  description = "The Diffie-Hellman parameter to use for establishing perfect forward secrecy with TLS"
  type        = string
}

variable "ingress_domains" {
  description = "The domains that can be used for network ingress to the cluster"
  type        = set(string)
}

variable "ingress_timeout" {
  description = "The timeout for connections flowing through the ingress"
  type        = number
  default     = 60
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "enable_tls_1_2" {
  description = "Whether to enable TLS 1.2 protocols"
  type        = bool
  default     = false
}