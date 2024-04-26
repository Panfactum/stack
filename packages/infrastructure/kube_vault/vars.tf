variable "vault_helm_version" {
  description = "The version of the vault helm chart to deploy"
  type        = string
  default     = "0.27.0"
}

variable "vault_image_tag" {
  description = "The version of vault to use"
  type        = string
  default     = "1.14.7" // This is the last open source release
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "vault_storage_size_gb" {
  description = "The number of gb to allocate to vault storage."
  type        = number
  default     = 20
}

variable "environment_domains" {
  description = "The public domains on which the vault subdomain will be created for vault connectivity (e.g., the input `production.panfactum.com` will expose vault on `vault.production.panfactum.com`)."
  type        = list(string)
  validation {
    condition     = length(var.environment_domains) >= 1
    error_message = "Must specify at least one domain in environment_domains"
  }
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "ingress_enabled" {
  description = "Whether or not to enable the ingress for routing traffic to vault"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

################################################################################
## KMS Access
################################################################################

variable "superuser_iam_arns" {
  description = "List of IAM arns for encryption key superusers."
  type        = list(string)
  default     = []
}

variable "admin_iam_arns" {
  description = "List of IAM arns for encryption key admins."
  type        = list(string)
  default     = []
}

variable "reader_iam_arns" {
  description = "List of IAM arns for users who can use the encryption key for encryption and decryption."
  type        = list(string)
  default     = []
}

variable "restricted_reader_iam_arns" {
  description = "List of IAM arns for users who can only view the encryption key."
  type        = list(string)
  default     = []
}