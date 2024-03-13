variable "additional_account_ids_with_record_access" {
  description = "Additional AWS account IDs for accounts that can assume with record manager role"
  type        = list(string)
  default     = []
}

variable "domain_names" {
  description = "A list of domain names in this account that the record manager role created by this module can manage"
  type        = set(string)
}