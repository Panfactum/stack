variable "domains" {
  description = "Domain names (keys) and their configs (values) for the zones."
  type = map(object({
    dnssec_enabled = optional(bool, false)
  }))
}