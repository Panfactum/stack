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

variable "cluster_issuer_name" {
  description = "Name of the ClusterIssuer to use for provisioning the cert"
  type        = string
  default     = null
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

// The default:
// rotate every 8 hours with a 16 hour buffer period in case something goes wrong
variable "duration" {
  description = "How long the certificate will be valid for."
  type        = string
  default     = "24h0m0s"
}

variable "renew_before" {
  description = "How long prior to the expiration that certificate renewal will be triggered."
  type        = string
  default     = "16h0m0s"
}
