variable "config_map_name" {
  description = "The name of the ConfigMap to sync"
  type        = string
}

variable "config_map_namespace" {
  description = "The namespace of the ConfigMap to sync"
}

variable "destination_namespaces" {
  description = "A list of namespaces to sync the ConfigMap to. If not specified, will sync to all namespaces."
  type        = list(string)
  default     = []
}

variable "excluded_namespaces" {
  description = "A list of namespaces that are explicitly excluded from having the ConfigMap copied to."
  type        = list(string)
  default     = []
}