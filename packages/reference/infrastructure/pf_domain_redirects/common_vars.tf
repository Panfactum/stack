variable "environment" {
  description = "The name of the environment the infrastructure is being deployed into. #injected"
  type        = string
  default     = null
}

variable "pf_root_module" {
  description = "The name of the root Panfactum module in the module tree. #injected"
  type        = string
  default     = "pf_website"
}

variable "pf_module" {
  description = "The name of the Panfactum module where the containing resources are directly defined. #injected"
  type        = string
  default     = "pf_website"
}

variable "region" {
  description = "The region the infrastructure is being deployed into. #injected"
  type        = string
  default     = null
}

variable "extra_tags" {
  description = "Extra tags or labels to add to the created resources. #injected"
  type        = map(string)
  default     = {}
}

variable "is_local" {
  description = "Whether this module is a part of a local development deployment #injected"
  type        = bool
  default     = false
}

variable "pf_stack_version" {
  description = "Which version of the Panfactum stack is being used (git ref) #injected"
  type        = string
  default     = "main"
}

variable "pf_stack_commit" {
  description = "The commit hash for the version of the Panfactum stack being used #injected"
  type        = string
  default     = "xxxxxxxxxxxxxxxxxxxxxxxxxxx"
}

variable "pf_module_source" {
  description = "The source for Panfactum submodules"
  type = string
}

variable "pf_module_ref" {
  description = "The git ref for Panfactum submodules"
  type = string
}