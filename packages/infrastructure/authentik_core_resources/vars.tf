variable "session_duration" {
  description = "The session duration for user logins. See https://docs.goauthentik.io/docs/flow/stages/user_login/"
  type        = string
  default     = "hours=8;minutes=0;seconds=0"
}

variable "organization_name" {
  description = "The name of the organization for which Authentik serves as the IdP"
  type        = string
}

variable "organization_domain" {
  description = "The domain name of the organization for which Authentik serves as the IdP"
  type        = string
}

variable "authentik_namespace" {
  description = "The kubernetes namespace where Authentik is deployed"
  type        = string
}

variable "email_templates_configmap" {
  description = "The configmap holding the email templates that Authentik will use"
  type        = string
}

variable "media_configmap" {
  description = "The configmap holding the static media that Authentik will use"
  type        = string
}

variable "superusers_require_webauthn" {
  description = "True iff superusers must use webauthn MFA to authenticate"
  type        = bool
  default     = true
}

variable "default_groups_enabled" {
  description = "Whether to create the default Panfactum RBAC groups"
  type        = bool
  default     = true
}

variable "extra_groups" {
  description = "Whether to create the default Panfactum RBAC groups"
  type = map(object({
    parent           = optional(string)
    require_webauthn = optional(bool, false)
  }))
  default = {}
}

// It must be an SVG due to this issue: https://github.com/hashicorp/terraform-provider-kubernetes/issues/2467
variable "logo_svg_b64" {
  description = "A stringified svg logo for displaying on the Authentik UI (base64 encoded)"
  type        = string
  default     = null
}

variable "favicon_ico_b64" {
  description = "A stringified ico image for displaying on the Authentik web UI (base64 encoded)"
  type        = string
  default     = null
}
