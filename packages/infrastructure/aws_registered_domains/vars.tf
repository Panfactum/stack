variable "domain_names" {
  description = "Domain names that will be managed by this module"
  type        = set(string)
}

variable "additional_account_ids_with_record_access" {
  description = "Additional AWS account IDs for accounts that can assume with record manager role"
  type        = list(string)
  default     = []
}

variable "enable_privacy_protection" {
  description = "Whether to enable Whois privacy protection"
  type        = bool
  default     = true
}

variable "enable_transfer_lock" {
  description = "Whether to enable domain transfer lock"
  type        = bool
  default     = true
}

variable "enable_auto_renew" {
  description = "Whether to enable automatic domain renewal"
  type        = bool
  default     = true
}

variable "admin_contact" {
  description = "Admin contact information for the domain"
  type = object({
    contact_type      = optional(string, "DEFAULT") # The type of the contact. Defaults to PERSON if organization_name is not provided. Otherwise, defaults to COMPANY.
    organization_name = optional(string)            # The name of the organization that the admin contact works for
    first_name        = string                      # The first name of the domain admin contact
    last_name         = string                      # The last name of the domain admin contact
    email_address     = string                      # The email address of the domain contact
    phone_number      = string                      # The phone number of the domain contact
    address_line_1    = string                      # The street address (1) of the domain admin contact
    address_line_2    = optional(string)            # The street address (2) of the domain admin contact
    city              = string                      # The city of the domain admin contact
    state             = string                      # The state or province of the domain admin contact
    zip_code          = string                      # The ZIP code of the domain admin contact
    country_code      = string                      # The country code of the domain admin contact
  })
  sensitive = true

  validation {
    condition     = contains(["PERSON", "COMPANY", "ASSOCIATION", "PUBLIC_BODY", "RESELLER", "DEFAULT"], var.admin_contact.contact_type)
    error_message = "admin_contact.contact_type has invalid value. Must be one of: PERSON, COMPANY, ASSOCIATION, PUBLIC_BODY, or RESELLER."
  }

  validation {
    condition     = can(regex("^\\+\\d{1,3}\\.\\d{1,26}$", var.admin_contact.phone_number)) && length(var.admin_contact.phone_number) <= 30
    error_message = "The phone number must be in the format +[country dialing code].[number including any area code], e.g., +1.1234567890, with a maximum length of 30 characters."
  }
}

variable "registrant_contact" {
  description = "Registrant contact information for the domain"
  type = object({
    contact_type      = optional(string, "DEFAULT") # The type of the contact. Defaults to PERSON if organization_name is not provided. Otherwise, defaults to COMPANY.
    organization_name = optional(string)            # The name of the organization that the registrant contact works for
    first_name        = string                      # The first name of the domain registrant contact
    last_name         = string                      # The last name of the domain registrant contact
    email_address     = string                      # The email address of the domain contact
    phone_number      = string                      # The phone number of the domain contact
    address_line_1    = string                      # The street address (1) of the domain registrant contact
    address_line_2    = optional(string)            # The street address (2) of the domain registrant contact
    city              = string                      # The city of the domain registrant contact
    state             = string                      # The state or province of the domain registrant contact
    zip_code          = string                      # The ZIP code of the domain registrant contact
    country_code      = string                      # The country code of the domain registrant contact
  })
  sensitive = true

  validation {
    condition     = contains(["PERSON", "COMPANY", "ASSOCIATION", "PUBLIC_BODY", "RESELLER", "DEFAULT"], var.registrant_contact.contact_type)
    error_message = "registrant_contact.contact_type has invalid value. Must be one of: PERSON, COMPANY, ASSOCIATION, PUBLIC_BODY, or RESELLER."
  }

  validation {
    condition     = can(regex("^\\+\\d{1,3}\\.\\d{1,26}$", var.registrant_contact.phone_number)) && length(var.registrant_contact.phone_number) <= 30
    error_message = "The phone number must be in the format +[country dialing code].[number including any area code], e.g., +1.1234567890, with a maximum length of 30 characters."
  }
}

variable "tech_contact" {
  description = "Tech contact information for the domain"
  type = object({
    contact_type      = optional(string, "DEFAULT") # The type of the contact. Defaults to PERSON if organization_name is not provided. Otherwise, defaults to COMPANY.
    organization_name = optional(string)            # The name of the organization that the tech contact works for
    first_name        = string                      # The first name of the domain tech contact
    last_name         = string                      # The last name of the domain tech contact
    email_address     = string                      # The email address of the domain contact
    phone_number      = string                      # The phone number of the domain contact
    address_line_1    = string                      # The street address (1) of the domain tech contact
    address_line_2    = optional(string)            # The street address (2) of the domain tech contact
    city              = string                      # The city of the domain tech contact
    state             = string                      # The state or province of the domain tech contact
    zip_code          = string                      # The ZIP code of the domain tech contact
    country_code      = string                      # The country code of the domain tech contact
  })
  sensitive = true

  validation {
    condition     = contains(["PERSON", "COMPANY", "ASSOCIATION", "PUBLIC_BODY", "RESELLER", "DEFAULT"], var.tech_contact.contact_type)
    error_message = "tech_contact.contact_type has invalid value. Must be one of: PERSON, COMPANY, ASSOCIATION, PUBLIC_BODY, or RESELLER."
  }

  validation {
    condition     = can(regex("^\\+\\d{1,3}\\.\\d{1,26}$", var.tech_contact.phone_number)) && length(var.tech_contact.phone_number) <= 30
    error_message = "The phone number must be in the format +[country dialing code].[number including any area code], e.g., +1.1234567890, with a maximum length of 30 characters."
  }
}

