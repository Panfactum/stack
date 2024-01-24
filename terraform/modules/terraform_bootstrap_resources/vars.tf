variable "state_bucket" {
  description = "The name of the terraform state bucket."
  type        = string
}

variable "lock_table" {
  description = "The name of the dynamodb terraform lock table.."
  type        = string
}
