variable "eks_cluster_name" {
  description = "The name of the eks cluster"
  type        = string
}

variable "eks_cluster_endpoint" {
  description = "The URL of the API server of the eks cluster"
  type        = string
}

variable "eks_cluster_ca_data" {
  description = "The B64 encoded CA data of the API server of the eks cluster"
  type        = string
}
