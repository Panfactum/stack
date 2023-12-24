variable "service_account" {
  description = "The name of the service account that should be able to assume the AWS permissions."
  type        = string
}

variable "service_account_namespace" {
  description = "The namespace of the service account."
  type        = string
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster that contains the service account."
  type        = string
}

variable "annotate_service_account" {
  description = "Whether or not to annotate the service account"
  type        = bool
  default     = true
}

variable "aad_sp_object_owners" {
  description = "The object ids for service principals that should own objects created in AAD"
  type        = list(string)
}

variable "public_outbound_ips" {
  description = "A list of the public ips for outbound cluster traffic"
  type        = list(string)
}

variable "service_principal_groups" {
  description = "The groups that this service principal will join"
  type        = set(string)
  default     = []
}

variable "msgraph_roles" {
  description = "Roles to assign to the service principal from MS graph"
  type        = set(string)
  default     = []
}
