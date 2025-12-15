variable "ecr_repositories" {
  description = "A mapping of names to configuration of the repositories to create."
  type = map(object({
    is_immutable      = optional(bool, true)  # Whether immutable tags are enabled
    expire_all_images = optional(bool, false) # Whether all images should be removed after 14 days
    expiration_rules = optional(list(object({
      tag_pattern = string
      days        = number # days since pushed that the image will be removed
    })), [])
    lifecycle_policy_json       = optional(string, null)     # Custom lifecycle policy JSON. When provided, overrides expire_all_images and expiration_rules
    additional_push_account_ids = optional(list(string), []) # The ids of the additional AWS accounts that have push access to the repository
    additional_pull_account_ids = optional(list(string), []) # The ids of the additional AWS accounts that have pull access to the repository
  }))
}
