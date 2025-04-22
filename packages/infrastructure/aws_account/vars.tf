variable "alias" {
  type        = string
  description = "The human-readable string for the AWS account."
}

variable "primary_contact" {
  type = object({
    full_name          = string           // The full name of the primary contact who manages your organization's AWS account
    address_line_1     = string           // The street address for your organization (line 1)
    address_line_2     = optional(string) // The street address for your organization (line 2)
    city               = string           // The city for your organization
    company_name       = string           // The name of your organization
    country_code       = string           // The ISO-3166 two-letter country code for your organization
    district_or_county = optional(string) // The district or county of your organization
    phone_number       = string           // The phone number of the primary contact who manages your organization's AWS account
    postal_code        = string           // The postal code for your organization
    state_or_region    = optional(string) // The state or region for your organization
    website_url        = optional(string) // The website of your organization
  })
  description = "Primary contact information for the AWS account"
  default     = null

  validation {
    condition     = var.primary_contact == null || can(regex("^\\+\\d{1,3} \\d{1,4}-\\d{1,4}-[\\d-]{4,20}$", var.primary_contact.phone_number))
    error_message = "The phone number must be in the format +[country dialing code] [area code]-[exchange-code]-[local-code], e.g., +1 555-555-5555"
  }
}

variable "security_contact" {
  type = object({
    email_address = string // The email address for the person who leads security for your organization
    full_name     = string // The full name of the person who leads security for your organization
    phone_number  = string // The phone number of the person who leads security for your organization
    title         = string // The title of the person who leads security for your organization
  })
  description = "Security contact information for the AWS account"
  default     = null

  validation {
    condition     = var.security_contact == null || can(regex("^\\+\\d{1,3} \\d{1,4}-\\d{1,4}-[\\d-]{4,20}$", var.security_contact.phone_number))
    error_message = "The phone number must be in the format +[country dialing code] [area code]-[exchange-code]-[local-code], e.g., +1 555-555-5555"
  }
}

variable "operations_contact" {
  type = object({
    email_address = string // The email address for the person who leads operations for your organization
    full_name     = string // The full name of the person who leads operations for your organization
    phone_number  = string // The phone number of the person who leads operations for your organization
    title         = string // The title of the person who leads operations for your organization
  })
  description = "Operations contact information for the AWS account"
  default     = null

  validation {
    condition     = var.operations_contact == null || can(regex("^\\+\\d{1,3} \\d{1,4}-\\d{1,4}-[\\d-]{4,20}$", var.operations_contact.phone_number))
    error_message = "The phone number must be in the format +[country dialing code] [area code]-[exchange-code]-[local-code], e.g., +1 555-555-5555"
  }
}

variable "billing_contact" {
  type = object({
    email_address = string // The email address where you want to receive invoices for your organization
    full_name     = string // The full name of the person who receives invoices for your organization
    phone_number  = string // The phone number of the person who receives invoices for your organization
    title         = string // The title of the person who receives invoices for your organization
  })
  description = "Billing contact information for the AWS account"
  default     = null

  validation {
    condition     = var.billing_contact == null || can(regex("^\\+\\d{1,3} \\d{1,4}-\\d{1,4}-[\\d-]{4,20}$", var.billing_contact.phone_number))
    error_message = "The phone number must be in the format +[country dialing code] [area code]-[exchange-code]-[local-code], e.g., +1 555-555-5555"
  }
}