variable "display_name" {
  description = "The display name of the application"
  type        = string
}

variable "description" {
  description = "A description of the application"
  type        = string
}

variable "redirect_uris" {
  description = "Allowed redirect uris for the oidc flow"
  type        = list(string)
}

variable "admin_group_object_ids" {
  description = "A list of security groups object ids that have admin access to the application"
  type        = list(string)
  default     = []
}

variable "admin_role_value" {
  description = "The admin role value to send to the SP for Admins."
  type        = string
}

variable "editor_group_object_ids" {
  description = "A list of security groups object ids that have editor access to the application"
  type        = list(string)
  default     = []
}

variable "editor_role_value" {
  description = "The editor role value to send to the SP for Editors."
  type        = string
}

variable "reader_group_object_ids" {
  description = "A list of security groups object ids that have reader access to the application"
  type        = list(string)
  default     = []
}

variable "reader_role_value" {
  description = "The reader role value to send to the SP for Readers."
  type        = string
}

variable "aad_sp_object_owners" {
  description = "The object ids for service principals that should own objects created in AAD"
  type        = list(string)
}
