variable "service_account" {
  description = "The name of the cert-manager service account."
  type        = string
  default     = "cert-manager"
}

variable "namespace" {
  description = "The name of the cert-manager namespace."
  type        = string
  default     = "cert-manager"
}

variable "route53_zones" {
  description = "A mapping of public DNS domains managed by AWS to their configuration; cert-manager uses this to issue public-facing certificates."
  type = map(object({
    record_manager_role_arn = string
    zone_id                 = string
  }))
  default = {}
}

variable "cloudflare_zones" {
  description = "A list of public DNS domains managed by Cloudflare; cert-manager uses this to issue public-facing certificates."
  type        = list(string)
  default     = []
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
  default     = null
}

variable "alert_email" {
  description = "An email that will receive certificate alerts."
  type        = string
}

variable "vault_internal_url" {
  description = "The url to the vault instance for internal cert issuance"
  type        = string
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "kube_domain" {
  description = "The domain under which cluster utilities have subdomains registered."
  type        = string
}