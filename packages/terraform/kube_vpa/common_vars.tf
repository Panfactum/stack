variable "environment" {
  description = "The name of the environment the infrastructure is being deployed into."
  type        = string
  default     = null
}

variable "pf_root_module" {
  description = "The name of the root Panfactum module in the module tree."
  type        = string
  default     = "kube_vpa"
}

variable "pf_module" {
  description = "The name of the Panfactum module where the containing resources are directly defined."
  type        = string
  default     = "kube_vpa"
}

variable "region" {
  description = "The region the infrastructure is being deployed into."
  type        = string
  default     = null
}

variable "extra_tags" {
  description = "Extra tags or labels to add to the created resources."
  type        = map(string)
  default     = {}
}

variable "is_local" {
  description = "Whether this module is a part of a local development deployment"
  type        = bool
  default     = false
}
