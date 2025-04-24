variable "links" {
  description = "Ancestor domains (keys) to their descendent zone configurations"
  type = map(list(object({
    subdomain    = string
    name_servers = list(string)
  })))
}


