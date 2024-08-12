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

variable "session_duration_hours" {
  description = "The number of hours that AWS sessions will last. This is NOT the time before needing to re-authenticate with your IdP, but rather the amount of time that AWS session tokens last before expiring."
  type        = number
  default     = 12
  validation {
    condition     = var.session_duration_hours <= 12
    error_message = "Must be less than or equal to 12 hours (AWS limitation)"
  }
}
