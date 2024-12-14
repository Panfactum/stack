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

variable "code_repo" {
  description = "The URL of the git repo containing the Dockerfile to build. Must NOT contain a protocol prefix."
  type        = string
  validation {
    condition     = !strcontains(var.code_repo, "//")
    error_message = "code_repo should NOT contain a protocol prefix such as https://"
  }
  validation {
    condition     = !strcontains(var.code_repo, "@")
    error_message = "code_repo should NOT contain a protocol git user prefix such as git@"
  }
}

variable "code_storage_gb" {
  description = "The size of the volume to mount the code into"
  type        = number
  default     = 1
}

variable "cpu_millicores" {
  description = "The amount of CPU to allocate to pods in the workflow (in millicores)"
  type        = number
  default     = 25
}

variable "memory_mb" {
  description = "The amount of memory to allocate to pods in the workflow (in MB)"
  type        = number
  default     = 100
}

variable "git_ref" {
  description = "The default git ref to checkout and build if none is provided to the WorkflowTemplate when executing the Workflow"
  type        = string
  default     = "main"
}

variable "build_context" {
  description = "Relative path from the root of the repository to the build context to submit to BuildKit"
  type        = string
  default     = "."
}

variable "dockerfile_path" {
  description = "Relative path from the root of the repository to the Dockerfile / Containerfile to submit to Buildkit"
  type        = string
  default     = "./Dockerfile"
}

variable "build_timeout" {
  description = "The number of seconds after which the build will be timed out"
  type        = number
  default     = 60 * 60
}

variable "image_repo" {
  description = "The name of the AWS ECR repository where generated images will be pushed"
  type        = string
}

variable "image_tag_prefix" {
  description = "The prefix to prepend to the image tag"
  type        = string
  default     = ""
}

variable "push_image_enabled" {
  description = "True iff images should be pushed to ECR in addition to being built"
  type        = bool
  default     = true
}

variable "secrets" {
  description = "A mapping of build-time secret ids to their respective values"
  type        = map(string)
  default     = {}
}

variable "args" {
  description = "A mapping of build-time arguments to their respective values"
  type        = map(string)
  default     = {}
}

variable "git_username" {
  description = "The username to use when checking out the code to deploy"
  type        = string
  default     = ""
}

variable "git_password" {
  description = "The password to use when checking out the code to deploy"
  type        = string
  default     = ""
  sensitive   = true
}

variable "extra_ecr_repo_arns_for_pull_access" {
  description = "ARNs of private ECR repositories from which the Dockerfile pulls base images FROM"
}
