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

variable "usages" {
  description = "Usages to add to the certificate"
  type        = list(string)
  default     = []
}

variable "common_name" {
  description = "Common name to add to add to the cert"
  type        = string
  default     = null
}

variable "issuer_name" {
  description = "Name of the ClusterIssuer/Issuer to use for provisioning the cert"
  type        = string
  default     = null
}

variable "use_cluster_issuer" {
  description = "Whether to use a ClusterIssuer. If false, will use an Issuer."
  type        = bool
  default     = true
}

variable "include_localhost" {
  description = "Whether to include localhost in the SANs"
  type        = bool
  default     = false
}

variable "include_subdomains" {
  description = "Whether to include subdomains of the services via wildcard"
  type        = bool
  default     = false
}

variable "private_key_encoding" {
  description = "The encoding of the private key. Must by `PKCS1` or `PKCS8`"
  type        = string
  default     = "PKCS1"
  validation {
    condition     = contains(["PKCS1", "PKCS8"], var.private_key_encoding)
    error_message = "The encoding must be either PKCS1 or PKCS8"
  }
}

variable "is_ca" {
  description = "Whether the certificate is a certificate authority certificate or not."
  type        = bool
  default     = false
}

variable "private_key_rotation_enabled" {
  description = "Whether to enable private key rotation."
  type        = bool
  default     = true
}

variable "private_key_algorithm" {
  description = "The algorithm to use for the private key. Must be one of: ECDSA, RSA"
  type        = string
  default     = "ECDSA"
  validation {
    condition     = contains(["ECDSA", "RSA"], var.private_key_algorithm)
    error_message = "private_key_alogirthm must be one of: ECDSA, RSA"
  }
}

// The default:
// rotate every week with a one week buffer period in case something goes wrong
variable "duration" {
  description = "How long the certificate will be valid for."
  type        = string
  default     = "336h0m0s"
}

variable "renew_before" {
  description = "How long prior to the expiration that certificate renewal will be triggered."
  type        = string
  default     = "168h0m0s"
}

variable "extra_labels" {
  description = "Extra labels to add to the Certificate and Secret resources"
  type        = map(string)
  default     = {}
}
