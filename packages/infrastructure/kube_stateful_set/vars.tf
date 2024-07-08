variable "namespace" {
  description = "The namespace the cluster is in"
  type        = string
}

variable "name" {
  description = "The name of this workload"
  type        = string
}

variable "priority_class_name" {
  description = "The priority class to use for pods in the StatefulSet"
  type        = string
  default     = null
}

variable "update_type" {
  description = "The type of update that the StatefulSEt should use"
  type        = string
  default     = "RollingUpdate"
}

variable "extra_tolerations" {
  description = "Extra tolerations to add to the pods"
  type = list(object({
    key      = optional(string)
    operator = string
    value    = optional(string)
    effect   = optional(string)
  }))
  default = []
}

variable "node_preferences" {
  description = "Node label preferences for the pods"
  type        = map(object({ weight = number, operator = string, values = list(string) }))
  default     = {}
}

variable "node_requirements" {
  description = "Node label requirements for the pods"
  type        = map(list(string))
  default     = {}
}

variable "secrets" {
  description = "Key pair values of secrets to add to the containers as environment variables"
  type        = map(string)
  default     = {}
}

variable "common_env" {
  description = "Key pair values of the environment variables for each container"
  type        = map(string)
  default     = {}
}

variable "replicas" {
  description = "The desired number of pods in the StatefulSet"
  type        = number
  default     = 1
}

variable "vpa_enabled" {
  description = "Whether to enable the vertical pod autoscaler"
  type        = bool
  default     = true
}


variable "ports" {
  description = "The port the application is listening on inside the container"
  type = map(object({
    service_port = number
    pod_port     = number
  }))
  default = {}
}

variable "containers" {
  description = "A list of container configurations for the pod"
  type = list(object({
    name                    = string
    init                    = optional(bool, false)
    image                   = string
    version                 = string
    command                 = list(string)
    image_pull_policy       = optional(string, "IfNotPresent")
    working_dir             = optional(string, null)
    minimum_memory          = optional(number, 100)        #The minimum amount of memory in megabytes
    maximum_memory          = optional(number, null)       #The maximum amount of memory in megabytes
    memory_limit_multiplier = optional(number, 1.3)        # memory limits = memory request x this value
    minimum_cpu             = optional(number, 10)         # The minimum amount of cpu millicores
    maximum_cpu             = optional(number, null)       # The maximum amount of cpu to allow (in millicores)
    privileged              = optional(bool, false)        # Whether to allow the container to run in privileged mode
    run_as_root             = optional(bool, false)        # Whether to run the container as root
    uid                     = optional(number, 1000)       # user to use when running the container if not root
    linux_capabilities      = optional(list(string), [])   # Default is drop ALL
    readonly                = optional(bool, true)         # Whether to use a readonly file system
    env                     = optional(map(string), {})    # Environment variables specific to the container
    liveness_check_command  = optional(list(string), null) # Will run the specified command as the liveness probe if type is exec
    liveness_check_port     = optional(number, null)       # The number of the port for the liveness_check
    liveness_check_type     = optional(string, null)       # Either exec, HTTP, or TCP
    liveness_check_route    = optional(string, null)       # The route if using HTTP liveness_checks
    liveness_check_scheme   = optional(string, "HTTP")     # HTTP or HTTPS
    ready_check_command     = optional(list(string), null) # Will run the specified command as the ready check probe if type is exec (default to liveness_check_command)
    ready_check_port        = optional(number, null)       # The number of the port for the ready check (default to liveness_check_port)
    ready_check_type        = optional(string, null)       # Either exec, HTTP, or TCP (default to liveness_check_type)
    ready_check_route       = optional(string, null)       # The route if using HTTP ready checks (default to liveness_check_route)
    ready_check_scheme      = optional(string, null)       # Whether to use HTTP or HTTPS (default to liveness_check_scheme)
  }))
}

variable "restart_policy" {
  description = "The pod restart policy"
  type        = string
  default     = "Always"
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
    node_local = optional(bool, false) # If true, the temporary storage will come from the node rather than a PVC
  }))
  default = {}
}

variable "secret_mounts" {
  description = "A mapping of Secret names to their mount configuration in the containers of the Pod"
  type = map(object({
    mount_path = string                # Where in the containers to mount the Secret
    optional   = optional(bool, false) # Whether the pod can launch if this Secret does not exist
  }))
  default = {}
}

variable "config_map_mounts" {
  description = "A mapping of ConfigMap names to their mount configuration in the containers of the Pod"
  type = map(object({
    mount_path = string                # Where in the containers to mount the ConfigMap
    optional   = optional(bool, false) # Whether the pod can launch if this ConfigMap does not exist
  }))
  default = {}
}
variable "pod_annotations" {
  description = "Annotations to add to the pods in the Pod"
  type        = map(string)
  default     = {}
}

variable "dynamic_secrets" {
  description = "Dynamic variable secrets"
  type = list(object({             // key is the secret provider class
    secret_provider_class = string // name of the secret provider class
    mount_path            = string // absolute path of where to mount the secret
    env_var               = string // name of the env var that will have a path to the secret mount
  }))
  default = []
}

variable "dns_policy" {
  description = "The DNS policy for the pods"
  type        = string
  default     = "ClusterFirst"
}

variable "instance_type_anti_affinity_required" {
  description = "Whether to prevent pods from being scheduled on the same instance types"
  type        = bool
  default     = false
}

variable "zone_anti_affinity_required" {
  description = "Whether to prevent pods from being scheduled on the same zone"
  type        = bool
  default     = false
}

variable "instance_type_anti_affinity_preferred" {
  description = "Whether to prefer preventing pods from being scheduled on the same instance types"
  type        = bool
  default     = false
}

variable "host_anti_affinity_required" {
  description = "Whether to prefer preventing pods from being scheduled on the same host"
  type        = bool
  default     = true
}

variable "prefer_spot_nodes_enabled" {
  description = "Whether pods will prefer scheduling on spot nodes"
  type        = bool
  default     = false
}

variable "prefer_burstable_nodes_enabled" {
  description = "Whether pods will prefer scheduling on burstable nodes"
  type        = bool
  default     = false
}

variable "prefer_arm_nodes_enabled" {
  description = "Whether pods will prefer scheduling on arm64 nodes"
  type        = bool
  default     = false
}

variable "spot_nodes_enabled" {
  description = "Whether to allow pods to schedule on spot nodes"
  type        = bool
  default     = false
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow pods to schedule on burstable nodes"
  type        = bool
  default     = false
}

variable "arm_nodes_enabled" {
  description = "Whether to allow pods to schedule on arm64 nodes"
  type        = bool
  default     = false
}

variable "topology_spread_strict" {
  description = "Whether the topology spread constraint should be set to DoNotSchedule"
  type        = bool
  default     = false
}

variable "topology_spread_enabled" {
  description = "Whether to enable topology spread constraints"
  type        = bool
  default     = true
}

variable "controller_node_required" {
  description = "Whether the pods must be scheduled on a controller node"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "pod_management_policy" {
  description = "The StatefulSets pod management policy "
  type        = string
  default     = "OrderedReady"
}

variable "termination_grace_period_seconds" {
  description = "The number of seconds to wait for graceful termination before forcing termination"
  type        = number
  default     = 30
}

variable "volume_mounts" {
  description = "A mapping of names to configuration for PersistentVolumeClaims used by the StatefulSet"
  type = map(object({
    storage_class              = optional(string, "ebs-standard-retained")
    access_modes               = optional(list(string), ["ReadWriteOnce"])
    initial_size_gb            = optional(number, 1)    # The initial size of the volume when first created
    size_limit_gb              = optional(number, null) # The maximum number of GB that this volume will scale to
    increase_threshold_percent = optional(number, 20)   # Dropping below this percent of free storage will trigger an automatic increase in storage size
    increase_gb                = optional(number, 1)    # The number of GB to increase the volume by when it needs to scale up
    mount_path                 = string                 # Where in the containers to mount the volume
    backups_enabled            = optional(bool, true)   # True iff velero should make snapshot backups of the volumes
  }))
}

variable "volume_retention_policy" {
  description = "The persistentVolumeClaimRetentionPolicy to use of the StatefulSet"
  type = object({
    when_deleted = optional(string, "Retain")
    when_scaled  = optional(string, "Retain")
  })
  default = {
    when_deleted = "Retain"
    when_scaled  = "Retain"
  }
}

variable "extra_pod_labels" {
  description = "Extra pod labels to use"
  type        = map(string)
  default     = {}
}

variable "ignore_replica_count" {
  description = "Whether to ignore changes to the replica count. Useful when implementing horizontal autoscaling."
  type        = bool
  default     = false
}

variable "max_unavailable" {
  description = "Sets the maxUnavailable field of the associated PodDisruptionBudget"
  type        = number
  default     = 1
}

variable "pod_version_labels_enabled" {
  description = "Whether to add version labels to the Pod. Useful for ensuring pods do not get recreated on frequent updates."
  type        = bool
  default     = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the annotator images"
  type        = bool
  default     = false
}
