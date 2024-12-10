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
  default     = "1.29"
}

variable "vpc_id" {
  description = "The id for the VPC that the cluster should be deployed into"
  type        = string
}

variable "control_plane_subnets" {
  description = "List of subnet names for the control plane. Must be in at least two different availability zones."
  type        = set(string)
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
}

variable "dns_service_ip" {
  description = "The IP address of the cluster's DNS service. Must be inside the service_cidr range."
  type        = string
}

variable "bootstrap_cluster_creator_admin_privileges" {
  description = "Whether to give cluster admin privileges to the cluster creator implicitly. Cannot be changed after cluster creation. For backwards compatibility purposes only."
  type        = bool
  default     = false
}

######################################################################################
# EKS add-ons versions
# For more info see: https://docs.aws.amazon.com/eks/latest/userguide/eks-add-ons.html
#######################################################################################

variable "core_dns_addon_enabled" {
  description = "FOR BACKWARDS COMPATIBILITY AND MIGRATIONS ONLY"
  type        = bool
  default     = false
}

variable "coredns_version" {
  description = "The version to use for the coredns EKS add-on."
  type        = string
  default     = "v1.11.1-eksbuild.6"
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

################################################################################
## KMS Access
################################################################################

variable "superuser_iam_arns" {
  description = "List of IAM arns for encryption key superusers."
  type        = list(string)
  default     = []
}

variable "admin_iam_arns" {
  description = "List of IAM arns for encryption key admins."
  type        = list(string)
  default     = []
}

variable "reader_iam_arns" {
  description = "List of IAM arns for users who can use the encryption key for encryption and decryption."
  type        = list(string)
  default     = []
}

variable "restricted_reader_iam_arns" {
  description = "List of IAM arns for users who can only view the encryption key."
  type        = list(string)
  default     = []
}
