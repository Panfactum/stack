variable "namespace" {
  description = "The namespace the cluster is in"
  type        = string
}

variable "name" {
  description = "The name of this CronJob"
  type        = string
}

variable "priority_class_name" {
  description = "The priority class to use for Pods in the CronJob"
  type        = string
  default     = null
}

variable "update_type" {
  description = "The type of update that the CronJob should use"
  type        = string
  default     = "RollingUpdate"
}

variable "extra_tolerations" {
  description = "Extra tolerations to add to the Pods"
  type = list(object({
    key      = optional(string)
    operator = string
    value    = optional(string)
    effect   = optional(string)
  }))
  default = []
}

variable "node_preferences" {
  description = "Node label preferences for the Pods"
  type        = map(object({ weight = number, operator = string, values = list(string) }))
  default     = {}
}

variable "node_requirements" {
  description = "Node label requirements for the Pods"
  type        = map(list(string))
  default     = {}
}

variable "common_secrets" {
  description = "Key pair values of secrets to add to the containers as environment variables"
  type        = map(string)
  default     = {}
}

variable "common_env" {
  description = "Key pair values of the environment variables for each container"
  type        = map(string)
  default     = {}
}

variable "common_env_from_secrets" {
  description = "Environment variables that are sourced from existing Kubernetes Secrets. The keys are the environment variables names and the values are the Secret references."
  type = map(object({
    secret_name = string
    key         = string
  }))
  default = {}
}

variable "common_env_from_config_maps" {
  description = "Environment variables that are sourced from existing Kubernetes ConfigMaps. The keys are the environment variables names and the values are the ConfigMap references."
  type = map(object({
    config_map_name = string
    key             = string
  }))
  default = {}
}

variable "vpa_enabled" {
  description = "Whether to enable the Vertical Pod Autoscaler"
  type        = bool
  default     = true
}

variable "containers" {
  description = "A list of container configurations for the Pod"
  type = list(object({
    name                    = string                           # A unique name for the container within the pod
    init                    = optional(bool, false)            # Iff true, the container will be an init container
    image_registry          = string                           # The URL for a container image registry (e.g., docker.io)
    image_repository        = string                           # The path to the image repository within the registry (e.g., library/nginx)
    image_tag               = string                           # The tag for a specific image within the repository (e.g., 1.27.1)
    image_pin_enabled       = optional(bool, true)             # Whether the image should be pinned to every node regardless of whether the container is running or not (speeds up startup times)
    image_prepull_enabled   = optional(bool, true)             # Whether the image will be prepulled to nodes when the nodes are first created (speeds up startup times)
    command                 = list(string)                     # The command to be run as the root process inside the container
    working_dir             = optional(string, null)           # The directory the command will be run in. If left null, will default to the working directory set by the image
    image_pull_policy       = optional(string, "IfNotPresent") # Sets the container's ImagePullPolicy
    minimum_memory          = optional(number, 100)            #The minimum amount of memory in megabytes
    maximum_memory          = optional(number, null)           #The maximum amount of memory in megabytes
    memory_limit_multiplier = optional(number, 1.3)            # memory limits = memory request x this value
    minimum_cpu             = optional(number, 10)             # The minimum amount of cpu millicores
    maximum_cpu             = optional(number, null)           # The maximum amount of cpu to allow (in millicores)
    privileged              = optional(bool, false)            # Whether to allow the container to run in privileged mode
    run_as_root             = optional(bool, false)            # Whether to run the container as root
    uid                     = optional(number, 1000)           # user to use when running the container if not root
    linux_capabilities      = optional(list(string), [])       # Default is drop ALL
    readonly                = optional(bool, true)             # Whether to use a readonly file system
    env                     = optional(map(string), {})        # Environment variables specific to the container
  }))
}

variable "restart_policy" {
  description = "The Pod restart policy"
  type        = string
  default     = "OnFailure"
}

variable "mount_owner" {
  description = "The ID of the group that owns the mounted volumes"
  type        = number
  default     = 1000
}

variable "tmp_directories" {
  description = "A mapping of temporary directory names (arbitrary) to their configuration"
  type = map(object({
    mount_path = string                # Where in the containers to mount the temporary directories
    size_mb    = optional(number, 100) # The number of MB to allocate for the directory
    node_local = optional(bool, false) # If true, the temporary storage will come from the host node rather than a PVC
  }))
  default = {}
}

variable "secret_mounts" {
  description = "A mapping of Secret names to their mount configuration in the containers of the CronJob"
  type = map(object({
    mount_path = string                # Where in the containers to mount the Secret
    optional   = optional(bool, false) # Whether the Pod can launch if this Secret does not exist
  }))
  default = {}
}

variable "config_map_mounts" {
  description = "A mapping of ConfigMap names to their mount configuration in the containers of the CronJob"
  type = map(object({
    mount_path = string                # Where in the containers to mount the ConfigMap
    optional   = optional(bool, false) # Whether the Pod can launch if this ConfigMap does not exist
  }))
  default = {}
}

variable "extra_pod_annotations" {
  description = "Annotations to add to the pods in the CronJob"
  type        = map(string)
  default     = {}
}

variable "dns_policy" {
  description = "The DNS policy for the Pod"
  type        = string
  default     = "ClusterFirst"
}

variable "spot_nodes_enabled" {
  description = "Whether to allow Pods to schedule on spot nodes"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow Pods to schedule on burstable nodes"
  type        = bool
  default     = false
}

variable "arm_nodes_enabled" {
  description = "Whether to allow Pods to schedule on arm64 nodes"
  type        = bool
  default     = true
}

variable "controller_nodes_enabled" {
  description = "Whether to allow pods to schedule on EKS Node Group nodes (controller nodes)"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum Pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "termination_grace_period_seconds" {
  description = "The number of seconds to wait for graceful termination before forcing termination"
  type        = number
  default     = 30
}

variable "extra_pod_labels" {
  description = "Extra pod labels to use"
  type        = map(string)
  default     = {}
}

variable "cron_schedule" {
  description = "The cron expression to use for the CronJob"
  type        = string
}

variable "failed_jobs_history_limit" {
  description = "The number of failed jobs to retain"
  type        = number
  default     = 1
}

variable "successful_jobs_history_limit" {
  description = "The number of successful jobs to retain"
  type        = number
  default     = 0
}

variable "suspend" {
  description = "Whether the CronJob is suspended"
  type        = bool
  default     = false
}

variable "starting_deadline_seconds" {
  description = "Optional deadline in seconds for starting the job if it misses scheduled time for any reason. Missed jobs executions will be counted as failed ones."
  type        = number
  default     = 60 * 15
}

variable "concurrency_policy" {
  description = "Specifies how to treat concurrent executions of a Job."
  type        = string
  default     = "Forbid"
  validation {
    condition     = contains(["Allow", "Forbid", "Replace"], var.concurrency_policy)
    error_message = "concurrency_policy must be one of: Allow, Forbid, Replace"
  }
}

variable "cron_job_annotations" {
  description = "Annotations to add to the generated CronJob"
  type        = map(string)
  default     = {}
}

variable "job_annotations" {
  description = "Annotations to add to generated Job resources"
  type        = map(string)
  default     = {}
}

variable "pod_parallelism" {
  description = "Specifies the maximum desired number of Pods the Job should run at any given time."
  type        = number
  default     = 1
}

variable "ttl_seconds_after_finished" {
  description = "limits the lifetime of a Job that has finished execution (either Complete or Failed). After this time, it is eligible to be automatically deleted."
  type        = number
  default     = 60 * 10
}

variable "pod_replacement_policy" {
  description = "Specifies when to create replacement Pods"
  type        = string
  default     = "Failed"
  validation {
    condition     = contains(["TerminatingOrFailed", "Failed"], var.pod_replacement_policy)
    error_message = "pod_replacement_policy must be one of: TerminatingOrFailed, Failed"
  }
}

variable "pod_completions" {
  description = "Specifies the desired number of successfully finished Pods the Job should be run with."
  type        = number
  default     = 1
}


variable "active_deadline_seconds" {
  description = "Specifies the duration in seconds relative to the startTime that the job may be continuously active before the system tries to terminate it; value must be positive integer."
  type        = number
  default     = 60 * 60 * 24
}

variable "backoff_limit" {
  description = "Specifies the number of retries before marking the Job failed."
  type        = number
  default     = 6
}

variable "disruptions_enabled" {
  description = "Whether to enable disrupting the Pods in the middle of execution."
  type        = bool
  default     = false
}

variable "pod_version_labels_enabled" {
  description = "Whether to add version labels to the Pod. Useful for ensuring pods do not get recreated on frequent updates."
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "node_image_cached_enabled" {
  description = "Whether to add the container images to the node image cache for faster startup times"
  type        = bool
  default     = true
}

variable "cilium_required" {
  description = "True iff the Cilium CNI is required to be installed on a node prior to scheduling on it"
  type        = bool
  default     = true
}

variable "linkerd_required" {
  description = "True iff the Linkerd CNI is required to be installed on a node prior to scheduling on it"
  type        = bool
  default     = true
}

variable "extra_labels" {
  description = "A map of extra labels that will be added to the CronJob (not the pods)"
  type        = map(string)
  default     = {}
}

variable "extra_annotations" {
  description = "A map of extra annotations that will be added to the CronJob (not the pods)"
  type        = map(string)
  default     = {}
}

