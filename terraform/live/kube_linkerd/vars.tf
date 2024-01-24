variable "linkerd_crd_helm_version" {
  description = "The version of the linkerd-crd helm chart to deploy"
  type        = string
  default     = "1.6.1"
}

variable "linkerd_cni_helm_version" {
  description = "The version of the linkerd-cni helm chart to deploy"
  type        = string
  default     = "30.8.3"
}

variable "linkerd_control_plane_helm_version" {
  description = "The version of the linkerd-control-plane helm chart to deploy"
  type        = string
  default     = "1.12.5"
}

variable "cert_manager_namespace" {
  description = "The namespace where cert-manager is deployed"
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

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
