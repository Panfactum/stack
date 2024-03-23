variable "hosted_zones" {
  description = "Zones that will be managed by this module"
  type        = map(string) // domain name => zone_id
}

