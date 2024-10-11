variable "zones" {
  description = "Zone configurations. Keys are the domain names."
  type = map(object({
    a_records = optional(list(object({
      subdomain = optional(string, "")
      records   = list(string)
      ttl       = optional(number, 300)
    })), [])
    mx_records = optional(list(object({
      subdomain = optional(string, "")
      records   = list(string)
      ttl       = optional(number, 86400)
    })), [])
    txt_records = optional(list(object({
      subdomain = optional(string, "")
      records   = list(string)
      ttl       = optional(number, 300)
    })), [])
    cname_records = optional(list(object({
      subdomain = string
      record    = string
      ttl       = optional(number, 300)
    })), [])
  }))

  validation {
    condition     = alltrue(flatten([for zone, config in var.zones : [for type in keys(config) : [for record in config[type] : !startswith(record.subdomain, ".")]]]))
    error_message = "Subdomains cannot start with a ."
  }
}

