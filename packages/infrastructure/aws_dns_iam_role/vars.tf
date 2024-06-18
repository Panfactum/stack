variable "additional_account_ids_with_record_access" {
  description = "Additional AWS account IDs for accounts that can assume with record manager role"
  type        = list(string)
  default     = []
}

variable "hosted_zone_ids" {
  description = "Zone IDs in this account that the record manager role created by this module can manage"
  type        = set(string)
}
