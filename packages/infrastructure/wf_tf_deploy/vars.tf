variable "name" {
  description = "The name of the WorkflowTemplate"
  type        = string
}

variable "namespace" {
  description = "The namespace to deploy the WorkflowTemplate into"
  type = string
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "repo_url" {
  description = "The repository url to deploy (same as PF_REPO_URL in devenv)"
  type = string
}

variable "iac_dir" {
  description = "The directory that holds infrastructure modules within the repository (same as PF_IAC_DIR in devenv)"
  type = string
  default = "infrastructure"
  validation {
    condition = !startswith(var.iac_dir, "/") && !startswith(var.iac_dir, ".")
    error_message = "iac_dir should NOT start with a leading / or ./"
  }
}

variable "environments_dir" {
  description = "The directory that holds configuration-as-code within the repository (same as PF_ENVIRONMENTS_DIR in devenv)"
  type = string
  default = "environments"
  validation {
    condition = !startswith(var.environments_dir, "/") && !startswith(var.environments_dir, ".")
    error_message = "environments_dir should NOT start with a leading / or ./"
  }
}

variable "repo_primary_branch" {
  description = "The primary integration branch of the repository (same as PF_REPO_PRIMARY_BRANCH in devenv)"
  type = string
  default = "main"
}

variable "repo_name" {
  description = "The name of the repository (same PF_REPO_NAME in devenv)"
  type = string
}

variable "tf_apply_dir" {
  description = "The directory where 'terragrunt run-all apply' should be executed. All modules in this directory tree will be deployed. Should be relative to the repository root."
  type = string
  validation {
    condition = !startswith(var.tf_apply_dir, "/") && !startswith(var.tf_apply_dir, ".")
    error_message = "tf_apply_dir should NOT start with a leading / or ./"
  }
}

variable "secrets" {
  description = "A mapping of environment variable names to secret values"
  type = map(string)
  default = {}
}

variable "memory_mb" {
  description = "The amount of memory to allocate to pods in the workflow (in MB)"
  type = number
  default = 2000
}

variable "cpu_millicores" {
  description = "The amount of CPU to allocate to pods in the workflow (in millicores)"
  type = number
  default = 500
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster that contains the service account."
  type        = string
}

variable "alternative_devenv_root" {
  description = "Used to manually set the DEVENV_ROOT environment variable in the execution context. Useful for scenarios where the DEVENV_ROOT isn't the root of the repository.s"
  type = string
  default = null
}
