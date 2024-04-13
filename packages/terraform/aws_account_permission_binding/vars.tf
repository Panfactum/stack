variable "sso_instance_arn" {
  description = "The sso instance arn for the AWS SSO connection"
  type        = string
}

variable "identity_store_id" {
  description = "The identity store ID for the AWS SSO connection"
  type        = string
}

variable "aws_account_id" {
  description = "The AWS account ID associated with the environment"
  type        = string
}

variable "superuser_groups" {
  description = "The groups to receive superuser aws access in this environment"
  type        = list(string)
}

variable "admin_groups" {
  description = "The groups to receive aws admin aws access in this environment"
  type        = list(string)
}

variable "reader_groups" {
  description = "The groups to receive reader aws access in this environment"
  type        = list(string)
}

variable "restricted_reader_groups" {
  description = "The groups to receive restricted reader aws access in this environment"
  type        = list(string)
}

variable "billing_admin_groups" {
  description = "The groups to receive billing admin aws access in this environment"
  type        = list(string)
}

variable "superuser_permission_set_arn" {
  description = "The arn of the superuser set of permissions"
  type        = string
}

variable "admin_permission_set_arn" {
  description = "The arn of the admin set of permissions"
  type        = string
}

variable "reader_permission_set_arn" {
  description = "The arn of the reader set of permissions"
  type        = string
}


variable "restricted_reader_permission_set_arn" {
  description = "The arn of the restricted reader set of permissions"
  type        = string
}

variable "billing_admin_permission_set_arn" {
  description = "The arn of the billing admin set of permissions"
  type        = string
}
