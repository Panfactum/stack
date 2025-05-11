variable "alias" {
  type        = string
  description = "The human-readable string for the AWS account."
}

variable "accounts" {
  description = "AWS accounts to create in the organization. Keys are arbitrary, but if changed /removed will delete the account."
  type = map(object({
    name              = string
    email             = string
    close_on_deletion = optional(bool, true)
    environment       = optional(string)

    // Can be used to override the alternate contact information on a per-account basis
    alternate_contacts = optional(object({
      security = optional(object({
        full_name     = string
        email_address = string
        phone_number  = string
        title         = string
      }))
      billing = optional(object({
        full_name     = string
        email_address = string
        phone_number  = string
        title         = string
      }))
      operations = optional(object({
        full_name     = string
        email_address = string
        phone_number  = string
        title         = string
      }))
    }), {})
  }))
  default = {}


  validation {
    condition     = alltrue(flatten([for account_name, account_config in var.accounts : [for type, info in account_config.alternate_contacts : can(regex("^\\+\\d{1,3} \\d{1,4}-\\d{1,4}-[\\d-]{4,20}$", info.phone_number)) if info != null]]))
    error_message = "The contact phone numbers must be in the format +[country dialing code] [area code]-[exchange-code]-[local-code], e.g., +1 555-555-5555"
  }
}


variable "primary_contact" {
  description = "The primary contact for the AWS organization"
  type = object({
    full_name          = string
    phone_number       = string
    address_line_1     = string
    address_line_2     = optional(string)
    address_line_3     = optional(string)
    city               = string
    company_name       = optional(string)
    country_code       = string // The ISO-3166 two-letter country code for your organization
    district_or_county = optional(string)
    postal_code        = string
    state_or_region    = optional(string)
    website_url        = optional(string)
  })

  validation {
    condition     = can(regex("^\\+\\d{1,3} \\d{1,4}-\\d{1,4}-[\\d-]{4,20}$", var.primary_contact.phone_number))
    error_message = "The phone number must be in the format +[country dialing code] [area code]-[exchange-code]-[local-code], e.g., +1 555-555-5555"
  }
}


variable "alternate_contacts" {
  description = "The alternate contacts for the AWS organization"
  type = object({
    security = optional(object({
      full_name     = string
      email_address = string
      phone_number  = string
      title         = string
    }))
    billing = optional(object({
      full_name     = string
      email_address = string
      phone_number  = string
      title         = string
    }))
    operations = optional(object({
      full_name     = string
      email_address = string
      phone_number  = string
      title         = string
    }))
  })

  default = {}

  validation {
    condition     = alltrue([for type, config in var.alternate_contacts : can(regex("^\\+\\d{1,3} \\d{1,4}-\\d{1,4}-[\\d-]{4,20}$", config.phone_number)) if config != null])
    error_message = "The contact phone numbers must be in the format +[country dialing code] [area code]-[exchange-code]-[local-code], e.g., +1 555-555-5555"
  }
}

variable "extra_aws_service_access_principals" {
  description = "Additional service access principals to use in addition to the Panfactum defaults"
  type        = list(string)
  default     = []

}
