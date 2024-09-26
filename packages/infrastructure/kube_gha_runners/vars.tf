variable "gha_runner_scale_set_helm_version" {
  description = "The version of the  actions-runner-controller-charts/gha-runner-scale-set helm chart to deploy"
  type        = string
  default     = "0.9.3"
}

variable "github_token" {
  description = "The GitHub token that the runners will use to register with GitHub"
  type        = string
  sensitive   = true
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "runners" {
  description = "A mapping of runner names to their configuration values"
  type = map(object({
    github_config_url     = string # The url for the organization or repository that the runners will belong to
    min_replicas          = optional(number, 0)
    max_replicas          = optional(number, 25)
    action_runner_image   = optional(string)
    action_runner_version = optional(string, "latest")
    tmp_space_gb          = optional(number, 1)   # The number of GB of disk space to allocate to the runner
    memory_mb             = optional(number, 250) # The number of MB of memory to allocate to the runner
    cpu_millicores        = optional(number, 100) # The number of millicores of cpu to allocate to the runner
    arm_nodes_enabled     = optional(bool, true)  # Whether to allow this runner to run on arm64 nodes
    spot_nodes_enabled    = optional(bool, true)  # Whether to allow this runner to run on spot nodes
  }))
}

variable "extra_env_secrets" {
  description = "A key-value mapping of extra secret environment variables for the runner pods"
  type        = map(string)
  default     = {}
}

variable "extra_pod_annotations" {
  description = "Annotations to add to every runner pod"
  type        = map(string)
  default     = {}
}

variable "extra_pod_labels" {
  description = "Labels to add to every runner pod"
  type        = map(string)
  default     = {}
}

variable "node_image_cache_enabled" {
  description = "Whether to use kube-fledged to cache images locally for better startup performance"
  type        = bool
  default     = true
}