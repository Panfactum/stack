variable "namespace" {
  description = "The namespace the DaemonSet should be created in"
  type        = string
}

variable "name" {
  description = "The name of this DaemonSet"
  type        = string
}

variable "priority_class_name" {
  description = "The priority class to use for pods in the DaemonSet"
  type        = string
  default     = "system-node-critical"
}

variable "update_type" {
  description = "The type of update that the DaemonSet should use. One of: RollingUpdate, OnDelete"
  type        = string
  default     = "RollingUpdate"

  validation {
    condition     = contains(["RollingUpdate", "OnDelete"], var.update_type)
    error_message = "update_type must be one of: RollingUpdate, OnDelete"
  }
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

variable "node_requirements" {
  description = "Node label requirements for the pods"
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

variable "min_ready_seconds" {
  description = "The minimum number of seconds for which a newly created pod should be ready without any of its containers crashing."
  type        = number
  default     = 5
}

variable "vpa_enabled" {
  description = "Whether to enable the vertical pod autoscaler"
  type        = bool
  default     = true
}

variable "containers" {
  description = "A list of container configurations for the pod"
  type = list(object({
    name                    = string                           # A unique name for the container within the pod
    init                    = optional(bool, false)            # Iff true, the container will be an init container
    image_registry          = string                           # The URL for a container image registry (e.g., docker.io)
    image_repository        = string                           # The path to the image repository within the registry (e.g., library/nginx)
    image_tag               = string                           # The tag for a specific image within the repository (e.g., 1.27.1)
    image_prepull_enabled   = optional(bool, true)             # Whether the image will be prepulled to nodes when the nodes are first created (speeds up startup times)
    image_pin_enabled       = optional(bool, false)            # Whether the image should be pinned to every node regardless of whether the container is running or not (speeds up startup times)
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
    read_only               = optional(bool, true)             # Whether to use a readonly file system
    env                     = optional(map(string), {})        # Environment variables specific to the container
    liveness_probe_command  = optional(list(string), null)     # Will run the specified command as the liveness probe if type is exec
    liveness_probe_port     = optional(number, null)           # The number of the port for the liveness_probe
    liveness_probe_type     = optional(string, null)           # Either exec, HTTP, or TCP
    liveness_probe_route    = optional(string, null)           # The route if using HTTP liveness_probes
    liveness_probe_scheme   = optional(string, "HTTP")         # HTTP or HTTPS
    readiness_probe_command = optional(list(string), null)     # Will run the specified command as the ready check probe if type is exec (default to liveness_probe_command)
    readiness_probe_port    = optional(number, null)           # The number of the port for the ready check (default to liveness_probe_port)
    readiness_probe_type    = optional(string, null)           # Either exec, HTTP, or TCP (default to liveness_probe_type)
    readiness_probe_route   = optional(string, null)           # The route if using HTTP ready checks (default to liveness_probe_route)
    readiness_probe_scheme  = optional(string, null)           # Whether to use HTTP or HTTPS (default to liveness_probe_scheme)
    ports = optional(map(object({                              # Keys are the port names, and the values are the port configuration.
      port              = number                               # Port on the backing pods that traffic should be routed to
      service_port      = optional(number, null)               # Port to expose on the service. defaults to port
      protocol          = optional(string, "TCP")              # One of TCP, UDP, or SCTP
      expose_on_service = optional(bool, true)                 # Whether this port should be listed on the DaemonSet's service
    })), {})
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
  description = "A mapping of Secret names to their mount configuration in the containers of the DaemonSet"
  type = map(object({
    mount_path = string                # Where in the containers to mount the Secret
    optional   = optional(bool, false) # Whether the pod can launch if this Secret does not exist
  }))
  default = {}
}

variable "config_map_mounts" {
  description = "A mapping of ConfigMap names to their mount configuration in the containers of the DaemonSet"
  type = map(object({
    mount_path = string                # Where in the containers to mount the ConfigMap
    optional   = optional(bool, false) # Whether the pod can launch if this ConfigMap does not exist
  }))
  default = {}
}

variable "extra_pod_annotations" {
  description = "Annotations to add to the pods in the DaemonSet"
  type        = map(string)
  default     = {}
}

variable "dns_policy" {
  description = "The DNS policy for the pods"
  type        = string
  default     = "ClusterFirst"
}

variable "spot_nodes_enabled" {
  description = "Whether to allow pods to schedule on spot nodes"
  type        = bool
  default     = true
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow pods to schedule on burstable nodes"
  type        = bool
  default     = true
}

variable "arm_nodes_enabled" {
  description = "Whether to allow pods to schedule on arm64 nodes"
  type        = bool
  default     = true
}

variable "controller_nodes_enabled" {
  description = "Whether to allow pods to schedule on EKS Node Group nodes (controller nodes)"
  type        = bool
  default     = true
}

variable "wait_for_rollout" {
  description = "Whether to wait for the DaemonSet rollout before allowing terraform to proceed"
  type        = bool
  default     = false
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

variable "pod_version_labels_enabled" {
  description = "Whether to add version labels to the Pod. Useful for ensuring pods do not get recreated on frequent updates."
  type        = bool
  default     = true
}

variable "unhealthy_pod_eviction_policy" {
  description = "Whether to allow unhealthy pods to be evicted. See https://kubernetes.io/docs/tasks/run-application/configure-pdb/#unhealthy-pod-eviction-policy."
  type        = string
  default     = "AlwaysAllow"
  validation {
    condition     = contains(["IfHealthyBudget", "AlwaysAllow"], var.unhealthy_pod_eviction_policy)
    error_message = "Must be one of: IfHealthyBudget or AlwaysAllow"
  }
}

variable "min_available" {
  description = "Controls how many pods are allowed to be unavailable in the DaemonSet under the Pod Disruption Budget"
  type        = number
  default     = 0
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "host_network" {
  description = "Whether the generated pods are allowed to use the host network"
  type        = bool
  default     = false
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
  description = "A map of extra labels that will be added to the DaemonSet (not the pods)"
  type        = map(string)
  default     = {}
}

variable "extra_annotations" {
  description = "A map of extra annotations that will be added to the DaemonSet (not the pods)"
  type        = map(string)
  default     = {}
}

