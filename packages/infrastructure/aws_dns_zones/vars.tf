variable "domain_names" {
  description = "Domain names for the zones."
  type        = set(string)
}


variable "dnssec_enabled" {
  description = "True iff DNSSEC should be enabled for the zones."
  type        = bool
  default     = false
}


