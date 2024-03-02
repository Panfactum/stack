variable "alb_controller_version" {
  description = "The version of aws-application-loadbalancer-controller to deploy"
  type        = string
  default     = "v2.5.4"
}

variable "alb_controller_helm_version" {
  description = "The version of aws-application-loadbalancer-controller helm chart to deploy"
  type        = string
  default     = "1.5.5"
}

variable "vpc_id" {
  description = "The ID of the VPC to use for AWS networked resources"
  type        = string
}

variable "nlb_subnets" {
  description = "List of subnet names to deploy NLBs into. Must be in at least two different availability zones."
  type        = set(string)
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster that this is being deployed to"
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "ip_allow_list" {
  description = "A list of IPs that can use the service account token to authneticate with AWS API"
  type        = list(string)
}
