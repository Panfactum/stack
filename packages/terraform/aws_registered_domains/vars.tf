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

variable "admin_organization_name" {
  description = "The name of the organization that the admin contact works for"
  type        = string
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

variable "registrant_organization_name" {
  description = "The name of the organization that the registrant contact works for"
  type        = string
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

