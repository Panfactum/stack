variable "environment" {
  description = "The name of the environment for the infrastructure."
  type        = string
}

variable "module" {
  description = "The name of the module."
  type        = string
}

variable "region" {
  description = "The region to work in."
  type        = string
}

variable "version_tag" {
  description = "Name of the application version or git commit ref."
  type        = string
}

variable "version_hash" {
  description = "The commit hash for the version. Used to reference build artifacts."
  type        = string
}

variable "is_local" {
  description = "Whether this module is a part of a local development deployment"
  type        = bool
}
