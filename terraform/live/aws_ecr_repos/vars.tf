variable "ecr_repository_names" {
  description = "The names of the repositories to create."
  type        = list(string)
}

variable "trusted_account_ids" {
  description = "The ids of the accounts that have completed access to each repository."
  type        = list(string)
  default     = []
}

variable "is_immutable" {
  description = "Whether immutable tags are enabled"
  type        = bool
  default     = true
}

variable "expire_tagged_images" {
  description = "Whether tagged images should be removed after 14 days"
  type        = bool
  default     = false
}
