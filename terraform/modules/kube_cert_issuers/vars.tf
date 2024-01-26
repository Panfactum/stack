variable "service_account" {
  description = "The name of the cert-manager service account."
  type        = string
}

variable "namespace" {
  description = "The name of the cert-manager namespace."
  type        = string
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "dns_zones" {
  description = "A mapping of public DNS domains to their configuration; cert-manager uses this to issue public-facing certificates."
  type = map(object({
    record_manager_role_arn = string
    zone_id                 = string
  }))
  default = {}
}

variable "alert_email" {
  description = "An email that will receive certificate alerts."
  type        = string
}

variable "vault_internal_pki_path" {
  description = "The path to the internal cert issuer in the vault instance"
  type        = string
}

variable "vault_internal_url" {
  description = "The url to the vault instance for internal cert issuance"
  type        = string
}

variable "ip_allow_list" {
  description = "A list of IPs that can use the service account token to authneticate with AWS API"
  type        = list(string)
}
