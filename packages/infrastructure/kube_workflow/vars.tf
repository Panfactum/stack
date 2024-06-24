variable "namespace" {
  description = "The namespace the cluster is in"
  type        = string
}

variable "name" {
  description = "The name of this Workflow"
  type        = string
}

variable "priority_class_name" {
  description = "The default priority class to use for Pods in the Workflow"
  type        = string
  default     = null
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
  description = "A mapping of Secret names to their mount configuration in the containers of the Workflow"
  type = map(object({
    mount_path = string                # Where in the containers to mount the Secret
    optional   = optional(bool, false) # Whether the Pod can launch if this Secret does not exist
  }))
  default = {}
}

variable "config_map_mounts" {
  description = "A mapping of ConfigMap names to their mount configuration in the containers of the Workflow"
  type = map(object({
    mount_path = string                # Where in the containers to mount the ConfigMap
    optional   = optional(bool, false) # Whether the Pod can launch if this ConfigMap does not exist
  }))
  default = {}
}

variable "pod_annotations" {
  description = "Annotations to add to the Pods in the Workflow"
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

variable "prefer_spot_nodes_enabled" {
  description = "Whether Pods will prefer scheduling on spot nodes"
  type        = bool
  default     = false
}

variable "prefer_burstable_nodes_enabled" {
  description = "Whether Pods will prefer scheduling on burstable nodes"
  type        = bool
  default     = false
}

variable "prefer_arm_nodes_enabled" {
  description = "Whether Pods will prefer scheduling on arm64 nodes"
  type        = bool
  default     = false
}

variable "spot_nodes_enabled" {
  description = "Whether to allow Pods to schedule on spot nodes"
  type        = bool
  default     = false
}

variable "burstable_nodes_enabled" {
  description = "Whether to allow Pods to schedule on burstable nodes"
  type        = bool
  default     = false
}

variable "arm_nodes_enabled" {
  description = "Whether to allow Pods to schedule on arm64 nodes"
  type        = bool
  default     = false
}

variable "controller_node_required" {
  description = "Whether the Pods must be scheduled on a controller node"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum Pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}

variable "extra_pod_labels" {
  description = "Extra Pod labels to use"
  type        = map(string)
  default     = {}
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster that contains the service account."
  type        = string
}

variable "ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "active_deadline_seconds" {
  description = "Duration in seconds relative to the workflow start time which the workflow is allowed to run before the controller terminates the Workflow"
  type        = number
  default     = 60 * 60 * 24
}

variable "archive_logs_enabled" {
  description = "Whether logs should be archived and made available in the Argo web UI"
  type        = bool
  default     = true
}

variable "dns_policy" {
  description = "The DNS policy for the Pods"
  type        = string
  default     = "ClusterFirst"
}

variable "on_exit" {
  description = "A template reference which is invoked at the end of the workflow, irrespective of the success, failure, or error of the primary template."
  type        = string
  default     = null
}

variable "task_parallelism" {
  description = "Limits the max total parallel tasks that can execute at the same time in a workflow"
  type        = number
  default     = null
}

variable "pod_delete_delay_seconds" {
  description = "The number of seconds after Workflow completion that Pods will be deleted"
  type        = number
  default     = 60 * 3
}

variable "priority" {
  description = "Priority is used if controller is configured to process limited number of workflows in parallel. Workflows with higher priority are processed first."
  type        = number
  default     = null
}

variable "workflow_delete_seconds_after_completion" {
  description = "The number of seconds after workflow completion that the Workflow object will be deleted"
  type        = number
  default     = 60 * 60 * 24
}

variable "workflow_delete_seconds_after_failure" {
  description = "The number of seconds after workflow failure that the Workflow object will be deleted"
  type        = number
  default     = 60 * 60 * 24
}

variable "workflow_delete_seconds_after_success" {
  description = "The number of seconds after workflow success that the Workflow object will be deleted"
  type        = number
  default     = 60 * 60
}

variable "extra_workflow_labels" {
  description = "Extra labels to add to the Workflow object"
  type        = map(string)
  default     = {}
}

variable "workflow_annotations" {
  description = "Annotations to add to the Workflow object"
  type        = map(string)
  default     = {}
}

variable "cluster_workflow_template_ref" {
  description = "Name is the resource name of the ClusterWorkflowTemplate template (https://argo-workflows.readthedocs.io/en/stable/cluster-workflow-templates/)"
  type        = string
  default     = null
}

variable "suspend" {
  description = "Whether this workflow is suspended"
  type        = bool
  default     = false
}

variable "entrypoint" {
  description = "Name of the template that will be used as the first node in this workflow"
  type        = string
}

variable "templates" {
  description = "A list of workflow templates. See https://argo-workflows.readthedocs.io/en/stable/fields/#template."
  type        = any
}

variable "retry_backoff_initial_duration_seconds" {
  description = "The initial number of seconds to wait before the next retry in an exponential backoff strategy"
  type        = number
  default     = 30
}

variable "retry_backoff_max_duration_seconds" {
  description = "The maximum number of seconds to wait before the next retry in an exponential backoff strategy"
  type        = number
  default     = 60 * 60
}

variable "retry_max_attempts" {
  description = "The maximum number of allowable retries"
  type        = number
  default     = 5
}

variable "retry_expression" {
  description = "Expression is a condition expression for when a node will be retried. If it evaluates to false, the node will not be retried and the retry strategy will be ignored."
  type        = string
  default     = null
}

variable "retry_policy" {
  description = "The policy that determines when the Workflow will be retried"
  type        = string
  default     = "Always"
  validation {
    condition     = contains(["Always", "OnFailure", "OnError", "OnTransientError"], var.retry_policy)
    error_message = "Must provide a valid retry_policy. See https://argo-workflows.readthedocs.io/en/stable/retries/#configuring-retrystrategy-in-workflowspec."
  }
}

variable "delete_artifacts_on_deletion" {
  description = "Change the default behavior to delete artifacts on workflow deletion"
  type        = bool
  default     = false
}

variable "disruptions_enabled" {
  description = "Whether disruptions should be enabled for Pods in the Workflow"
  type        = bool
  default     = false
}

variable "uid" {
  description = "The UID to use for the user in the Pods"
  type        = number
  default     = 1000
}

variable "run_as_root" {
  description = "Whether to enable running as root in the Pods"
  type        = bool
  default     = false
}

variable "volume_mounts" {
  description = "A mapping of names to configuration for PersistentVolumeClaims used by all Pods in the Workflow"
  type = map(object({
    storage_class = optional(string, "ebs-standard")
    access_modes  = optional(list(string), ["ReadWriteOnce"])
    size_gb       = optional(number, 1) # The size of the volume in GB
    mount_path    = string              # Where in the containers to mount the volume
  }))
  default = {}
}

variable "workflow_parallelism" {
  description = "Number of concurrent instances of this Workflow allowed to be running at any given time"
  type        = number
  default     = 1
}

variable "read_only_root_fs" {
  description = "Whether the generated containers default to read-only root filesystems"
  type        = bool
  default     = true
}

variable "privileged" {
  description = "Whether the generated containers run with elevated privileges"
  type        = bool
  default     = false
}

variable "linux_capabilities" {
  description = "Extra linux capabilities to add to containers by default"
  type        = list(string)
  default     = []
}

variable "arguments" {
  description = "The arguments to set for the Workflow"
  type = object({
    artifacts  = optional(list(any), [])
    parameters = optional(list(any), [])
  })
  default = {
    artifacts  = []
    parameters = []
  }
}

variable "default_resources" {
  description = "The default container resources to use"
  type = object({
    requests = optional(object({
      memory = optional(string, "100Mi")
      cpu    = optional(string, "50m")
    }), { memory = "100Mi", cpu = "50m" })
    limits = optional(object({
      memory = optional(string, "100Mi")
      cpu    = optional(string, null)
    }), { memory = "100Mi" })
  })
  default = {
    requests = {
      cpu    = "50m"
      memory = "100Mi"
    }
    limits = {
      memory = "100Mi"
    }
  }
}

variable "default_container_image" {
  description = "The default container image to use"
  type        = string
  default     = "docker.io/library/busybox:1.36.1"
}

variable "extra_aws_permissions" {
  description = "Extra JSON-encoded AWS permissions to assign to the Workflow's service account"
  type        = string
  default     = "{}"
}

