variable "namespace" {
  description = "The namespace where the service account and cluster live"
  type        = string
}

variable "service_account" {
  description = "The name of the service account"
  type        = string
}

variable "kube_labels" {
  description = "Labels to apply to Kubernetes resources"
  type        = map(string)
}

variable "database_role" {
  description = "The database role to use"
  type        = string
}
