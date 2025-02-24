variable "organization_id" {
  description = "ID of the MongoDB Atlas organization"
  type        = string
  validation {
    condition     = length(var.organization_id) == 24
    error_message = "The organization ID must be exactly 24 characters long."
  }
}

variable "federation_settings_id" {
  description = "The IDP ID from MongoDB Atlas"
  type        = string
  validation {
    condition     = length(var.federation_settings_id) == 24
    error_message = "The federation settings ID must be exactly 24 characters long."
  }
}

variable "idp_id" {
  description = "The IDP ID from MongoDB Atlas"
  type        = string
  validation {
    condition     = length(var.idp_id) == 24
    error_message = "The IDP ID must be exactly 24 characters long."
  }
}

variable "associated_domains" {
  type        = list(string)
  description = "The domains associated with the identity provider"
  default     = []
}

variable "sso_debug_enabled" {
  description = "Enable SSO debug. This allows users to login with a password bypassing the SSO flow."
  type        = bool
  default     = true
}

variable "active" {
  type        = bool
  description = "The status of the identity provider in MongoDB Atlas. Setting to false will disable the identity provider and SSO will not function."
  default     = true
}

variable "sso_url" {
  description = "The SSO URL"
  type        = string
}

variable "issuer_url" {
  description = "The issuer URL"
  type        = string
}

variable "name" {
  description = "The name of the identity provider"
  type        = string
  default     = "Panfactum Authentik Integration"
}

variable "extra_role_mappings" {
  description = "Extra authentik roles to map to MongoDB Atlas roles. `{<panfactum role> => [<mongodb role>, ...]}`"
  type        = map(list(string))
  default     = {}

  validation {
    condition = alltrue([
      for roles in values(var.extra_role_mappings) :
      alltrue([for role in roles : contains([
        "ORG_OWNER",
        "ORG_BILLING_ADMIN",
        "ORG_GROUP_CREATOR",
        "ORG_MEMBER",
        "ORG_READ_ONLY"
      ], role)])
    ])
    error_message = "Invalid MongoDB Atlas role found in extra_role_mappings. Allowed roles: ORG_OWNER, ORG_BILLING_ADMIN, ORG_GROUP_CREATOR, ORG_MEMBER, ORG_READ_ONLY."
  }
}