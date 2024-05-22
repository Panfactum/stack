variable "alb_controller_helm_version" {
  description = "The version of aws-application-loadbalancer-controller helm chart to deploy"
  type        = string
  default     = "1.7.2"
}

variable "vpc_id" {
  description = "The ID of the VPC to use for AWS networked resources"
  type        = string
}

variable "subnets" {
  description = "List of subnet names to deploy load balancers into. Must be in at least two different availability zones."
  type        = set(string)
  validation {
    condition     = length(var.subnets) >= 2
    error_message = "Must specify at least 2 subnets"
  }
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

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "The log level for the ALB controller pods"
  type        = string
  default     = "warning"
  validation {
    condition     = contains(["info", "error", "fatal", "panic", "warning", "debug", "trace"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}


