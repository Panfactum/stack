variable "namespace" {
  description = "The namespace the cluster is in"
  type        = string
}

variable "name" {
  description = "The name of this deployment"
  type        = string
}

variable "priority_class_name" {
  description = "The priority class to use for pods in the deployment"
  type        = string
  default     = null
}

variable "deployment_update_type" {
  description = "The type of update that the deployment should use"
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

variable "min_replicas" {
  description = "The desired (minimum) number of instances of the service"
  type        = number
  default     = 2
}

variable "max_replicas" {
  description = "The maximum number of instances of the service"
  type        = number
  default     = 10
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
    name                  = string
    init                  = optional(bool, false)
    image                 = string
    version               = string
    command               = list(string)
    image_pull_policy     = optional(string, "IfNotPresent")
    working_dir           = optional(string, null)
    minimum_memory        = optional(number, 100)      #The minimum amount of memory in megabytes
    minimum_cpu           = optional(number, 10)       # The minimum amount of cpu millicores
    run_as_root           = optional(bool, false)      # Whether to run the container as root
    uid                   = optional(number, 1000)     # user to use when running the container if not root
    linux_capabilities    = optional(list(string), []) # Default is drop ALL
    readonly              = optional(bool, true)       # Whether to use a readonly file system
    env                   = optional(map(string), {})  # Environment variables specific to the container
    liveness_check_port   = optional(number, null)     # The number of the port for the liveness_check
    liveness_check_type   = optional(string, null)     # Either HTTP or TCP
    liveness_check_route  = optional(string, null)     # The route if using HTTP liveness_checks
    liveness_check_scheme = optional(string, "HTTP")   # HTTP or HTTPS
    ready_check_port      = optional(number, null)     # The number of the port for the ready_check (default to liveness_check_port)
    ready_check_type      = optional(string, null)     # Either HTTP or TCP (default to liveness_check_type)
    ready_check_route     = optional(string, null)     # The route if using HTTP ready_checks (default to liveness_check_route)
    ready_check_scheme    = optional(string, null)     # Whether to use HTTP or HTTPS (default to liveness_check_scheme)
  }))
}

variable "restart_policy" {
  description = "The pod restart policy"
  type        = string
  default     = "Always"
}

variable "tmp_directories" {
  description = "A list of paths that contain empty temporary directories"
  type = map(object({
    size_gb = optional(number, 1)
  }))
  default = {}
}

variable "mount_owner" {
  description = "The ID of the group that owns the mounted volumes"
  type        = number
  default     = 1000
}

variable "secret_mounts" {
  description = "A mapping of Kubernetes secret names to their absolute mount paths in the containers of the deployment"
  type        = map(string)
  default     = {}
}

variable "config_map_mounts" {
  description = "A list ConfigMap names to their absolute mount paths in the containers of the deployment"
  type        = map(string)
  default     = {}
}


variable "pod_annotations" {
  description = "Annotations to add to the pods in the deployment"
  type        = map(string)
  default     = {}
}

variable "service_account" {
  description = "The name of the service account to use for this deployment"
  type        = string
  default     = null
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
  description = "Whether to pods will prefer scheduling on spot nodes (default true if spot nodes allowed)"
  type        = bool
  default     = null
}

variable "prefer_burstable_nodes_enabled" {
  description = "Whether to pods will prefer scheduling on burstable nodes (default true if burstable nodes allowed)"
  type        = bool
  default     = null
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

variable "controller_node_required" {
  description = "Whether the pods must be scheduled on a controller node"
  type        = bool
  default     = false
}

variable "wait_for_rollout" {
  description = "Whether to wait for the deployment rollout before allowing terraform to proceed"
  type        = bool
  default     = false
}

