variable "deregistration_delay_seconds" {
  description = "The deregistration delay for NLB targets in seconds"
  type        = number
  default     = 300
}

variable "access_logs_expiration_days" {
  description = "How long to store access logs in days."
  type        = number
  default     = 30
}

variable "name_prefix" {
  description = "A prefix to the load balancer's name"
  type        = string
}