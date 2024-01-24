variable "namespace" {
  description = "The namespace the cluster is in"
  type        = string
}

variable "service_names" {
  description = "The names of the kubernetes service(s) to use for the domain names"
  type        = list(string)
  default     = []
}

variable "secret_name" {
  description = "The name of the secret to save the keypair to"
  type        = string
}

variable "labels" {
  description = "Labels to apply to the certificate"
  type        = map(string)
}

variable "usages" {
  description = "Usages to add to the certificate"
  type        = list(string)
  default     = []
}

variable "common_name" {
  description = "Common name to add to add to the cert"
  type        = string
  default     = "default"
}
