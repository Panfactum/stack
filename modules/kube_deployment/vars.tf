variable "namespace" {
  description = "The namespace the cluster is in"
  type        = string
}

variable "service_name" {
  description = "The name of the service this deployment is for"
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

variable "tolerations" {
  description = "A list of tolerations for the pods"
  type = list(object({
    key      = string
    operator = string
    value    = string
    effect   = string
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
    name               = string
    init               = optional(bool, false)
    image              = string
    version            = string
    command            = list(string)
    minimum_memory     = optional(number, 100)      #The minimum amount of memory in megabytes
    minimum_cpu        = optional(number, 10)       # The minimum amount of cpu millicores
    run_as_root        = optional(bool, false)      # Whether to run the container as root
    uid                = optional(number, 1000)     # user to use when running the container if not root
    linux_capabilities = optional(list(string), []) # Default is drop ALL
    readonly           = optional(bool, true)       # Whether to use a readonly file system
    env                = optional(map(string), {})  # Environment variables specific to the container
    healthcheck_port   = optional(number, null)     # The number of the port for the healthcheck
    healthcheck_type   = optional(string, null)     # Either HTTP or TCP
    healthcheck_route  = optional(string, null)     # The route if using HTTP healthchecks
  }))
}

variable "restart_policy" {
  description = "The pod restart policy"
  type        = string
  default     = "Always"
}


variable "kube_labels" {
  description = "The default labels to use for Kubernetes resources"
  type        = map(string)
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

variable "is_local" {
  description = "Whether this module is a part of a local development deployment"
  type        = bool
  default     = false
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
