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

variable "kube_control_plane_version" {
  description = "Desired Kubernetes master version."
  type        = string
}

variable "kube_control_plane_subnets" {
  description = "List of subnet names for the control plane. Must be in at least two different availability zones."
  type        = set(string)
}

variable "kube_control_plane_legacy_role_name" {
  description = "A legacy role name for the kubernetes cluster IAM role. Useful as impossible to change the name of existing roles."
  type        = string
  default     = ""
}

variable "kube_control_plane_logging" {
  description = "Which log streams to turn on for the control plane (will be sent to Cloudwatch and forwarded to DataDog)"
  type        = set(string)
  default     = []
  validation {
    condition = length(setsubtract(var.kube_control_plane_logging, [
      "api",
      "audit",
      "authenticator",
      "controllerManager",
      "scheduler"
    ])) == 0
    error_message = "The only allowed log types are api, audit, authenticator, controllerManager, and scheduler."
  }
}

######################################################################################
# EKS add-ons versions
# For more info see: https://docs.aws.amazon.com/eks/latest/userguide/eks-add-ons.html
#######################################################################################
variable "coredns_version" {
  description = "The version to use for the coredns EKS add-on."
  type        = string
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
}

variable "all_nodes_allowed_security_groups" {
  description = "Names of security groups allowed to communicate directly with the cluster nodes."
  type        = set(string)
}
