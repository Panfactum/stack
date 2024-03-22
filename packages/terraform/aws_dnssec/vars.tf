variable "hosted_zone_ids" {
  description = "Domain names that will be managed by this module"
  type        = set(string)
}

