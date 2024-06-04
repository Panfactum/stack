variable "domain" {
  description = "Domain name that will send emails"
  type        = string
}

variable "send_from_subdomain" {
  description = "The default subdomain to send emails from"
  type        = string
  default     = "mail"
}

variable "smtp_allowed_cidrs" {
  description = "CIDR blocks that can use the SMTP credentials"
  type        = list(string)
  default     = []
}

