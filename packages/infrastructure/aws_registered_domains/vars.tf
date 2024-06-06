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

variable "admin_contact_type" {
  description = "The type of the contact. Defaults to PERSON if admin_organization_name is not provided. Otherwise, defaults to COMPANY."
  type        = string
  default     = "DEFAULT"

  validation {
    condition     = contains(["PERSON", "COMPANY", "ASSOCIATION", "PUBLIC_BODY", "RESELLER", "DEFAULT"], var.admin_contact_type)
    error_message = "admin_contact_type has invalid value. Must be one of: PERSON, COMPANY, ASSOCIATION, PUBLIC_BODY, or RESELLER."
  }
}

variable "admin_organization_name" {
  description = "The name of the organization that the admin contact works for"
  type        = string
  default     = null
}

variable "admin_first_name" {
  description = "The first name of the domain admin contact"
  type        = string
}

variable "admin_last_name" {
  description = "The last name of the domain admin contact"
  type        = string
}

variable "admin_email_address" {
  description = "The email address of the domain contact"
  type        = string
  sensitive   = true
}

variable "admin_phone_number" {
  description = "The phone number of the domain contact"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^\\+\\d{1,3}\\.\\d{1,26}$", var.admin_phone_number)) && length(var.admin_phone_number) <= 30
    error_message = "The phone number must be in the format +[country dialing code].[number including any area code], e.g., +1.1234567890, with a maximum length of 30 characters."
  }
}

variable "admin_address_line_1" {
  description = "The street address (1) of the domain admin contact"
  type        = string
  sensitive   = true
}

variable "admin_address_line_2" {
  description = "The street address (2) of the domain admin contact"
  type        = string
  default     = null
  sensitive   = true
}

variable "admin_city" {
  description = "The city of the domain admin contact"
  type        = string
  sensitive   = true
}

variable "admin_state" {
  description = "The state or province of the domain admin contact"
  type        = string
}

variable "admin_zip_code" {
  description = "The ZIP code of the domain admin contact"
  type        = string
  sensitive   = true
}

variable "admin_country_code" {
  description = "The country code of the domain admin contact"
  type        = string
}

variable "registrant_contact_type" {
  description = "The type of the contact. Defaults to PERSON if registrant_organization_name is not provided. Otherwise, defaults to COMPANY."
  type        = string
  default     = "DEFAULT"

  validation {
    condition     = contains(["PERSON", "COMPANY", "ASSOCIATION", "PUBLIC_BODY", "RESELLER", "DEFAULT"], var.registrant_contact_type)
    error_message = "registrant_contact_type has invalid value. Must be one of: PERSON, COMPANY, ASSOCIATION, PUBLIC_BODY, or RESELLER."
  }
}

variable "registrant_organization_name" {
  description = "The name of the organization that the registrant contact works for"
  type        = string
  default     = null
}

variable "registrant_first_name" {
  description = "The first name of the domain registrant contact"
  type        = string
}

variable "registrant_last_name" {
  description = "The last name of the domain registrant contact"
  type        = string
}

variable "registrant_email_address" {
  description = "The email address of the domain contact"
  type        = string
  sensitive   = true
}

variable "registrant_phone_number" {
  description = "The phone number of the domain contact"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^\\+\\d{1,3}\\.\\d{1,26}$", var.registrant_phone_number)) && length(var.registrant_phone_number) <= 30
    error_message = "The phone number must be in the format +[country dialing code].[number including any area code], e.g., +1.1234567890, with a maximum length of 30 characters."
  }
}

variable "registrant_address_line_1" {
  description = "The street address (1) of the domain registrant contact"
  type        = string
  sensitive   = true
}

variable "registrant_address_line_2" {
  description = "The street address (2) of the domain registrant contact"
  type        = string
  default     = null
  sensitive   = true
}

variable "registrant_city" {
  description = "The city of the domain registrant contact"
  type        = string
  sensitive   = true
}

variable "registrant_state" {
  description = "The state or province of the domain registrant contact"
  type        = string
}

variable "registrant_zip_code" {
  description = "The ZIP code of the domain registrant contact"
  type        = string
  sensitive   = true
}

variable "registrant_country_code" {
  description = "The country code of the domain registrant contact"
  type        = string
}

variable "tech_organization_name" {
  description = "The name of the organization that the tech contact works for"
  type        = string
  default     = null
}

variable "tech_contact_type" {
  description = "The type of the contact. Defaults to PERSON if tech_organization_name is not provided. Otherwise, defaults to COMPANY."
  type        = string
  default     = "DEFAULT"

  validation {
    condition     = contains(["PERSON", "COMPANY", "ASSOCIATION", "PUBLIC_BODY", "RESELLER", "DEFAULT"], var.tech_contact_type)
    error_message = "tech_contact_type has invalid value. Must be one of: PERSON, COMPANY, ASSOCIATION, PUBLIC_BODY, or RESELLER."
  }
}

variable "tech_first_name" {
  description = "The first name of the domain tech contact"
  type        = string
}

variable "tech_last_name" {
  description = "The last name of the domain tech contact"
  type        = string
}

variable "tech_email_address" {
  description = "The email address of the domain contact"
  type        = string
  sensitive   = true
}

variable "tech_phone_number" {
  description = "The phone number of the domain contact"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^\\+\\d{1,3}\\.\\d{1,26}$", var.tech_phone_number)) && length(var.tech_phone_number) <= 30
    error_message = "The phone number must be in the format +[country dialing code].[number including any area code], e.g., +1.1234567890, with a maximum length of 30 characters."
  }
}

variable "tech_address_line_1" {
  description = "The street address (1) of the domain tech contact"
  type        = string
  sensitive   = true
}

variable "tech_address_line_2" {
  description = "The street address (2) of the domain tech contact"
  type        = string
  default     = null
  sensitive   = true
}

variable "tech_city" {
  description = "The city of the domain tech contact"
  type        = string
  sensitive   = true
}

variable "tech_state" {
  description = "The state or province of the domain tech contact"
  type        = string
}

variable "tech_zip_code" {
  description = "The ZIP code of the domain tech contact"
  type        = string
  sensitive   = true
}

variable "tech_country_code" {
  description = "The country code of the domain tech contact"
  type        = string
}

