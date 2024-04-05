variable "domain" {
  description = "Domain name that will send emails"
  type        = string
}

variable "dmarc_policy" {
  description = "The DMARC policy for sent emails"
  type        = string
  default     = "quarantine"

  validation {
    condition     = contains(["none", "quarantine", "reject"], var.dmarc_policy)
    error_message = "The policy must be one of: none, quarantine, or reject"
  }
}

variable "dmarc_report_email" {
  description = "The contact email for DMARC reports from email service providers"
  type        = string
}

variable "send_from_subdomain" {
  description = "The default subdomain to send emails from"
  type        = string
  default     = "mail"
}

