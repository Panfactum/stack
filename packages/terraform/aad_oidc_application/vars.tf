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

variable "group_object_ids" {
  description = "A list of security groups object ids that have access to the application"
  type        = list(string)
}

variable "aad_sp_object_owners" {
  description = "The object ids for service principals that should own objects created in AAD"
  type        = list(string)
}
