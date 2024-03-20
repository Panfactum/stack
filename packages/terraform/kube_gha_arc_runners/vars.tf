variable "gha_runner_scale_set_version" {
  description = "The version of the arc scale set to deploy"
  type        = string
  default     = "0.6.1"
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "scale_set_name" {
  description = "How the scale set will be referenced in GHA workflows"
  type        = string
  default     = "self-hosted"
}

variable "github_config_url" {
  description = "The url for the organization that the runner will belong to"
  type        = string
}

variable "github_app_id" {
  description = "The app id for the GitHub app used to authenticate the runner"
  type        = string
}

variable "github_app_installation_id" {
  description = "The installation id for the GitHub app used to authenticate the runner"
  type        = string
}

variable "github_app_private_key" {
  description = "The private key for the GitHub app used to authenticate the runner"
  type        = string
}

variable "gha_runner_max_replicas" {
  description = "The maximum number of runners to use"
  type        = number
}

variable "gha_runner_env_prefix" {
  description = "The prefix to append to each runner's name"
  type        = string
}

variable "small_runner_config" {
  description = "Configuration for the small runner"
  type = object({
    min_replicas   = optional(number, 0)
    tmp_space_gb   = number # The number of GB of disk space to allocate to the runner
    memory_mb      = number # The number of MB of memory to allocate to the runner
    cpu_millicores = number # The number of millicores of cpu to allocate to the runner
  })
}

variable "medium_runner_config" {
  description = "Configuration for the medium runner"
  type = object({
    min_replicas   = optional(number, 0)
    tmp_space_gb   = number # The number of GB of disk space to allocate to the runner
    memory_mb      = number # The number of MB of memory to allocate to the runner
    cpu_millicores = number # The number of millicores of cpu to allocate to the runner
  })
}

variable "large_runner_config" {
  description = "Configuration for the large runner"
  type = object({
    min_replicas   = optional(number, 0)
    tmp_space_gb   = number # The number of GB of disk space to allocate to the runner
    memory_mb      = number # The number of MB of memory to allocate to the runner
    cpu_millicores = number # The number of millicores of cpu to allocate to the runner
  })
}


variable "arc_controller_service_account_namespace" {
  description = "The namespace of the ARC controller"
  type        = string
}

variable "arc_controller_service_account_name" {
  description = "The name of the ARC controller's service account"
  type        = string
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "vault_internal_address" {
  description = "The address of the vault cluster for this CI runner"
  type        = string
  default     = "http://vault-active.vault.svc.cluster.local:8200"
}

variable "ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
}

variable "runner_image" {
  description = "The runner image to use"
  type        = string
}

variable "tf_lock_table" {
  description = "The tf lock table to clear when runners are terminated"
  type        = string
}
variable "aad_group" {
  description = "The group the GHA runner service principal should join"
  type        = string
}
variable "extra_env_secrets" {
  description = "A key-value mapping of extra secret environment variables for the runner pods"
  type        = map(string)
  default     = {}
}

