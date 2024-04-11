variable "account_access_configuration" {
  type = map(object({
    account_id               = string
    superuser_groups         = list(string)
    admin_groups             = optional(list(string), [])
    reader_groups            = optional(list(string), [])
    restricted_reader_groups = optional(list(string), [])
  }))
}
