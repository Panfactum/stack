variable "secret_name" {
  description = "The name of the Secret to sync"
  type        = string
}

variable "secret_namespace" {
  description = "The namespace of the Secret to sync"
}

variable "destination_namespaces" {
  description = "A list of namespaces to sync the Secret to. If not specified, will sync to all namespaces."
  type        = list(string)
  default     = []
}

variable "excluded_namespaces" {
  description = "A list of namespaces that are explicitly excluded from having the Secret copied to."
  type        = list(string)
  default     = []
}