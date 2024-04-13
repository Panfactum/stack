variable "account_access_configuration" {
  description = "Configuration for assigning access to various AWS accounts via Identity Center"
  type = map(object({
    account_id               = string
    superuser_groups         = list(string)
    admin_groups             = optional(list(string), [])
    reader_groups            = optional(list(string), [])
    restricted_reader_groups = optional(list(string), [])
    billing_admin_groups     = optional(list(string), [])
  }))
}
