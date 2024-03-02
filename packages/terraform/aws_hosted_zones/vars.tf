variable "zones" {
  description = "Zone configurations. Keys are the domain names."
  type = map(object({
    mx_records = optional(list(object({
      subdomain = string
      records   = list(string)
      ttl       = optional(number, 86400)
    })), [])
    txt_records = optional(list(object({
      subdomain = string
      records   = list(string)
      ttl       = optional(number, 300)
    })), [])
    ns_records = optional(list(object({
      subdomain = string
      records   = list(string)
      ttl       = optional(number, 86400)
    })), [])
  }))
}

