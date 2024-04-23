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

variable "control_plane_version" {
  description = "Desired Kubernetes master version."
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

######################################################################################
# EKS add-ons versions
# For more info see: https://docs.aws.amazon.com/eks/latest/userguide/eks-add-ons.html
#######################################################################################

variable "coredns_version" {
  description = "The version to use for the coredns EKS add-on."
  type        = string
  default     = "v1.11.1-eksbuild.6"
}

################################################################################
## Node Group Configurations
################################################################################

variable "controller_node_count" {
  description = "The number of controller nodes to use"
  type        = number
}

variable "controller_node_instance_types" {
  description = "The allowable instance types for the controller nodes"
  type        = list(string)
}

variable "controller_node_subnets" {
  description = "List of names for subnets that controller nodes should be deployed to"
  type        = list(string)
}

variable "controller_node_kube_version" {
  description = "The version of kubernetes to use on the nodes"
  type        = string
  default     = "1.29"
}

variable "all_nodes_allowed_security_groups" {
  description = "Names of security groups allowed to communicate directly with the cluster nodes."
  type        = set(string)
  default     = []
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
