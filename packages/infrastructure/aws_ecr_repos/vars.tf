variable "ecr_repositories" {
  description = "A mapping of names to configuration of the repositories to create."
  type = map(object({
    is_immutable      = optional(bool, true)  # Whether immutable tags are enabled
    expire_all_images = optional(bool, false) # Whether all images should be removed after 14 days
    expiration_rules = optional(list(object({
      tag_pattern = string
      days        = number # days since pushed that the image will be removed
    })), [])
  }))
}

variable "trusted_account_ids" {
  description = "The ids of the accounts that have completed access to each repository."
  type        = list(string)
  default     = []
}
