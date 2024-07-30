variable "name" {
  description = "The name of the WorkflowTemplate"
  type        = string
}

variable "namespace" {
  description = "The namespace to deploy the WorkflowTemplate into"
  type        = string
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "repo_url" {
  description = "The url of the git repository containing the configuration-as-code that should be applied. Must NOT contain a protocol prefix."
  type        = string
  validation {
    condition     = !strcontains(var.repo_url, "//")
    error_message = "repo_url should NOT contain a protocol prefix such as https://"
  }
  validation {
    condition     = !strcontains(var.repo_url, "@")
    error_message = "repo_url should NOT contain a protocol git user prefix such as git@"
  }
}

variable "tf_apply_dir" {
  description = "The directory where 'terragrunt run-all apply' should be executed. All modules in this directory tree will be deployed. Should be relative to the repository root."
  type        = string
  validation {
    condition     = !startswith(var.tf_apply_dir, "/") && !startswith(var.tf_apply_dir, ".")
    error_message = "tf_apply_dir should NOT start with a leading / or ./"
  }
}

variable "secrets" {
  description = "A mapping of environment variable names to secret values"
  type        = map(string)
  default     = {}
}

variable "memory_mb" {
  description = "The amount of memory to allocate to pods in the workflow (in MB)"
  type        = number
  default     = 2500
}

variable "cpu_millicores" {
  description = "The amount of CPU to allocate to pods in the workflow (in millicores)"
  type        = number
  default     = 500
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster that contains the service account."
  type        = string
}
