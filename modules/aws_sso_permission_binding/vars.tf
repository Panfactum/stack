variable "sso_instance_arn" {
  description = "The sso instance arn for the AWS SSO connection"
  type        = string
}

variable "identity_store_id" {
  description = "The identity store ID for the AWS SSO connection"
  type        = string
}

variable "environment" {
  description = "The environment this permission binding is for"
  type        = string
}

variable "aws_account_id" {
  description = "The AWS account ID associated with the environment"
  type        = string
}

variable "superuser_groups" {
  description = "The groups to recieve superuser aws access in this environment"
  type        = list(string)
}

variable "admin_groups" {
  description = "The groups to recieve aws admin aws access in this environment"
  type        = list(string)
}

variable "reader_groups" {
  description = "The groups to recieve reader aws access in this environment"
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
