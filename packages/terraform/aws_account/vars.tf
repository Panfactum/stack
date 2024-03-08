variable "alias" {
  type        = string
  description = "The human-readable string for the AWS account."
}

variable "contact_address_line_1" {
  type        = string
  description = "The street address for your organization (line 1)"
}

variable "contact_address_line_2" {
  type        = string
  description = "The street address for your organization (line 2)"
  default     = null
}

variable "contact_city" {
  type        = string
  description = "The city for your organization"
}

variable "contact_company_name" {
  type        = string
  description = "The name of your organization"
}

variable "contact_country_code" {
  type        = string
  description = "The ISO-3166 two-letter country code for your organization"
}

variable "contact_district_or_county" {
  type        = string
  description = "The district or county of your organization"
  default     = null
}

variable "contact_full_name" {
  type        = string
  description = "The full name of the primary contact who manages your organization's AWS account"
}

variable "contact_phone_number" {
  type        = string
  description = "The phone number of the primary contact who manages your organization's AWS account"
}

variable "contact_postal_code" {
  type        = string
  description = "The postal code for your organization"
}

variable "contact_state_or_region" {
  type        = string
  description = "The state or region for your organization"
  default     = null
}

variable "contact_website_url" {
  type        = string
  description = "The website your organization"
  default     = null
}

variable "security_email_address" {
  type        = string
  description = "The email address for the person who leads security for your organization"
}

variable "security_full_name" {
  type        = string
  description = "The full name of the person who leads security for your organization"
}

variable "security_phone_number" {
  type        = string
  description = "The phone number of the person who leads security for your organization"
}

variable "security_title" {
  type        = string
  description = "The title of the person who leads security for your organization"
}

variable "operations_email_address" {
  type        = string
  description = "The email address for the person who leads operations for your organization"
}

variable "operations_full_name" {
  type        = string
  description = "The full name of the person who leads operations for your organization"
}

variable "operations_phone_number" {
  type        = string
  description = "The phone number of the person who leads operations for your organization"
}

variable "operations_title" {
  type        = string
  description = "The title of the person who leads operations for your organization"
}

variable "billing_email_address" {
  type        = string
  description = "The email address where you want to receive invoices for your organization"
}

variable "billing_full_name" {
  type        = string
  description = "The full name of the person who receives invoices for your organization"
}

variable "billing_phone_number" {
  type        = string
  description = "The phone number of the person who receives invoices for your organization"
}

variable "billing_title" {
  type        = string
  description = "The title of the person who receives invoices for your organization"
}