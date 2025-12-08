################################################################################
## Control Plane Config
################################################################################
variable "cluster_name" {
  description = "The name of the EKS cluster resource."
  type        = string
}

variable "cluster_description" {
  description = "The purpose of the EKS cluster."
  type        = string
}

variable "kube_version" {
  description = "Desired Kubernetes version to use for all subsystems. Use only major and minor specifiers as patches will be automatically applied."
  type        = string
  default     = "1.32"
}

variable "vpc_id" {
  description = "The id for the VPC that the cluster should be deployed into"
  type        = string
}

variable "control_plane_subnets" {
  description = "List of subnet names for the control plane. Must be in at least two different availability zones."
  type        = set(string)
  default     = [] // By default, will look up the default subnets deployed by the aws_vpc module. If you customize your aws_vpc deployment, you will need to provide the names of the PUBLIC subnets that were created.

  validation {
    condition     = length(var.control_plane_subnets) != 1
    error_message = "You must specify at least 2 control_plane_subnets."
  }
}

variable "control_plane_logging" {
  description = "Which log streams to turn on for the control plane (will be sent to Cloudwatch and forwarded to DataDog)"
  type        = set(string)
  default     = []
  validation {
    condition = length(setsubtract(var.control_plane_logging, [
      "api",
      "audit",
      "authenticator",
      "controllerManager",
      "scheduler"
    ])) == 0
    error_message = "The only allowed log types are api, audit, authenticator, controllerManager, and scheduler."
  }
}

variable "enable_public_access" {
  description = "Whether the cluster control plane should be available from the public internet."
  type        = bool
  default     = true
}

variable "public_access_cidrs" {
  description = "IP address ranges that can access the public control plane API endpoint."
  type        = set(string)
  default     = ["0.0.0.0/0"]
}

variable "service_cidr" {
  description = "CIDR block that kubernetes will use for assigning service and pod ID addresses."
  type        = string
  default     = "172.20.0.0/16"
}

variable "dns_service_ip" {
  description = "The IP address of the cluster's DNS service. Must be inside the service_cidr range."
  type        = string
  default     = "172.20.0.10"
}

variable "bootstrap_cluster_creator_admin_privileges" {
  description = "Whether to give cluster admin privileges to the cluster creator implicitly. Cannot be changed after cluster creation. For backwards compatibility purposes only."
  type        = bool
  default     = false
}

variable "extended_support_enabled" {
  description = "Whether to enable extended support for EOL Kubernetes versions."
  type        = bool
  default     = true
}

################################################################################
## Node Group Configurations
################################################################################

variable "bootstrap_mode_enabled" {
  description = "Whether the cluster is being bootstrapped and does not yet have the autoscaler enabled."
  type        = bool
  default     = false
}

variable "node_subnets" {
  description = "List of names for subnets that controller nodes should be deployed to"
  type        = list(string)
}

variable "node_security_groups" {
  description = "Names of security groups allowed to communicate directly with the cluster nodes."
  type        = set(string)
  default     = []
}

variable "node_ebs_volume_size_gb" {
  description = "The size of the EBS volume in GiB to use for each node."
  type        = number
  default     = 40
}

variable "node_ami_name" {
  description = "The name of the AMI to use for the controller nodes."
  type        = string
  default     = "bottlerocket-aws-k8s-1.32-aarch64-v1.51.0-47438798"
}

variable "spot_nodes_enabled" {
  description = "Whether to create spot instances instead of on-demand instances"
  type        = bool
  default     = true
}

################################################################################
## Access Control
################################################################################

variable "root_user_access_entry_enabled" {
  description = "Whether to enable the root user access entry"
  type        = bool
  default     = true
}

variable "extra_superuser_principal_arns" {
  description = "Grants read-write access to all resources to the indicated principals."
  type        = list(string)
  default     = []
}

variable "extra_admin_principal_arns" {
  description = "Grants read-write access to most resources (not included top-level cluster configuration) to the indicated principals."
  type        = list(string)
  default     = []
}

variable "extra_reader_principal_arns" {
  description = "Grants read access to all resources (including secrets) to the indicated principals."
  type        = list(string)
  default     = []
}

variable "extra_restricted_reader_principal_arns" {
  description = "Grants read access to all resources (not including secrets) to the indicated principals."
  type        = list(string)
  default     = []
}
