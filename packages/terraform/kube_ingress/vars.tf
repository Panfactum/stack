variable "namespace" {
  description = "The namespace the ingress resource should be created"
  type        = string
}

variable "name" {
  description = "The name of the ingresses that will get created"
  type        = string
}

variable "ingress_configs" {
  description = "A list of ingress names to the configuration to use for the ingress"
  type = list(object({

    # THis ingress matches all incoming requests on the indicated domains that have the indicated path prefixes
    domains       = list(string)
    path_prefix   = optional(string, "/")
    remove_prefix = optional(bool, false) # True iff the the path_prefix should be stripped before forwarding on to upstream service

    # The backing Kubernetes service
    service      = string
    service_port = number

    # Allows redirecting a subset of traffic to a different service;
    # For use in migrating functionality between services
    rewrite_rules = optional(list(object({
      path_regex   = string # A regex to match against incoming paths
      path_rewrite = string # The new path to use
    })), [])
  }))
}

variable "rate_limiting_enabled" {
  description = "Whether to enable rate limiting"
  type        = bool
  default     = true
}

variable "csp_enabled" {
  description = "Whether the Content-Security-Policy header should be added to responses"
  type        = bool
  default     = false
}

variable "csp_override" {
  description = "Whether to override the Content-Security-Response header if set from the upstream server"
  type        = bool
  default     = false
}

variable "csp_non_html" {
  description = "The full content security policy for non-HTML responses"
  type        = string
  // This will prevent CSP bypasses
  // https://lab.wallarm.com/how-to-trick-csp-in-letting-you-run-whatever-you-want-73cb5ff428aa/
  default = "default-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests"
}

variable "csp_connect_src" {
  description = "The connect-src content security policy"
  type        = string
  default     = "'self' ws:"
}

variable "csp_default_src" {
  description = "The default-src content security policy"
  type        = string
  default     = "'self'"
}

variable "csp_fenced_frame_src" {
  description = "The fenced-frame-src content security policy"
  type        = string
  default     = null
}

variable "csp_font_src" {
  description = "The font-src content security policy"
  type        = string
  default     = "'self' https: data:"
}

variable "csp_frame_src" {
  description = "The frame-src content security policy"
  type        = string
  default     = null
}

variable "csp_img_src" {
  description = "The img-src content security policy"
  type        = string
  default     = "'self' data:"
}


variable "csp_manifest_src" {
  description = "The manifest-src content security policy"
  type        = string
  default     = null
}

variable "csp_media_src" {
  description = "The media-src content security policy"
  type        = string
  default     = null
}

variable "csp_object_src" {
  description = "The object-src content security policy"
  type        = string
  default     = "'none'"
}

variable "csp_script_src" {
  description = "The script-src content security policy"
  type        = string
  default     = null
}

variable "csp_script_src_elem" {
  description = "The script-src-elem content security policy"
  type        = string
  default     = null
}

variable "csp_style_src" {
  description = "The style-src content security policy"
  type        = string
  default     = "'self'"
}

variable "csp_style_src_elem" {
  description = "The style-src-elem content security policy"
  type        = string
  default     = null
}

variable "csp_style_src_attr" {
  description = "The style-src-attr content security policy"
  type        = string
  default     = null
}

variable "csp_worker_src" {
  description = "The worker-src content security policy"
  type        = string
  default     = null
}

variable "csp_base_uri" {
  description = "The base-uri content security policy"
  type        = string
  default     = null
}

variable "csp_sandbox" {
  description = "The sandbox content security policy"
  type        = string
  default     = null
}

variable "csp_form_action" {
  description = "The form-action content security policy"
  type        = string
  default     = null
}

variable "csp_frame_ancestors" {
  description = "The frame-ancestors content security policy"
  type        = string
  default     = null
}

variable "csp_report_uri" {
  description = "The report-uri content security policy"
  type        = string
  default     = null
}
variable "csp_report_to" {
  description = "The report-to content security policy"
  type        = string
  default     = null
}

variable "cross_origin_isolation_enabled" {
  description = "Whether to enable the Cross-Origin-Opener-Policy header"
  type        = bool
  default     = false
}

variable "cross_origin_opener_policy" {
  description = "The value for the Cross-Origin-Opener-Policy header"
  type        = string
  // Change to `same-origin-allow-popups` if you have SSO popups
  // that are loaded from a different domain
  default = "same-origin"
}

variable "cross_origin_embedder_policy" {
  description = "The value for the Cross-Origin-Embedder-Policy header"
  type        = string
  default     = "require-corp"
}

variable "cross_origin_resource_policy" {
  description = "The value for the Cross-Origin-Resource-Policy header"
  type        = string
  // We use same-site by default as we assume users will
  // likely have control of the same top-level domain
  default = "same-site"
}

variable "permissions_policy_enabled" {
  description = "Whether to enable the Permissions-Policy header in HTML responses."
  type        = bool
  default     = false
}

variable "permissions_policy_override" {
  description = "Whether to override the Permissions-Policy header if set from the upstream server"
  type        = bool
  default     = false
}

variable "permissions_policy_accelerometer" {
  description = "The permissions policy for the accelerometer directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_ambient_light_sensor" {
  description = "The permissions policy for the ambient-light-sensor directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_autoplay" {
  description = "The permissions policy for the autoplay directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_battery" {
  description = "The permissions policy for the battery directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_bluetooth" {
  description = "The permissions policy for the bluetooth directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_camera" {
  description = "The permissions policy for the camera directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_display_capture" {
  description = "The permissions policy for the display-capture directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_document_domain" {
  description = "The permissions policy for the document-domain directive"
  type        = string
  default     = "(self)"
}

variable "permissions_policy_encrypted_media" {
  description = "The permissions policy for the encrypted-media directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_execution_while_not_rendered" {
  description = "The permissions policy for the execution-while-not-rendered directive"
  type        = string
  default     = "(self)"
}

variable "permissions_policy_execution_while_out_of_viewport" {
  description = "The permissions policy for the execution-while-out-of-viewport directive"
  type        = string
  default     = "(self)"
}

variable "permissions_policy_fullscreen" {
  description = "The permissions policy for the fullscreen directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_gamepad" {
  description = "The permissions policy for the gamepad directive"
  type        = string
  default     = "(self)"
}

variable "permissions_policy_geolocation" {
  description = "The permissions policy for the geolocation directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_gyroscope" {
  description = "The permissions policy for the gyroscope directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_hid" {
  description = "The permissions policy for the hid directive"
  type        = string
  default     = "(self)"
}

variable "permissions_policy_identity_credentials_get" {
  description = "The permissions policy for the identity-credentials-get directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_idle_detection" {
  description = "The permissions policy for the idle-detection directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_local_fonts" {
  description = "The permissions policy for the local-fonts directive"
  type        = string
  default     = "(self)"
}

variable "permissions_policy_magnetometer" {
  description = "The permissions policy for the magnetometer directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_microphone" {
  description = "The permissions policy for the microphone directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_midi" {
  description = "The permissions policy for the midi directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_otp_credentials" {
  description = "The permissions policy for the otp-credentials directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_payment" {
  description = "The permissions policy for the payment directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_picture_in_picture" {
  description = "The permissions policy for the picture-in-picture directive"
  type        = string
  default     = "(self)"
}

variable "permissions_policy_publickey_credentials_create" {
  description = "The permissions policy for the publickey-credentials-create directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_publickey_credentials_get" {
  description = "The permissions policy for the publickey-credentials-get directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_screen_wake_lock" {
  description = "The permissions policy for the screen-wake-lock directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_serial" {
  description = "The permissions policy for the serial directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_speaker_selection" {
  description = "The permissions policy for the speaker-selection directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_storage_access" {
  description = "The permissions policy for the storage-access directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_usb" {
  description = "The permissions policy for the usb directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_web_share" {
  description = "The permissions policy for the web-share directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_window_management" {
  description = "The permissions policy for the window-management directive"
  type        = string
  default     = "()"
}

variable "permissions_policy_xr_spatial_tracking" {
  description = "The permissions policy for the xr-spatial-tracking directive"
  type        = string
  default     = "()"
}

variable "referrer_policy" {
  description = "The value for Referrer-Policy header."
  type        = string
  default     = "no-referrer"

  validation {
    condition     = contains(["no-referrer", "same-origin", "strict-origin", "strict-origin-when-cross-origin"], var.referrer_policy)
    error_message = "Invalid value for referrer_policy"
  }
}

variable "x_frame_options" {
  description = "The value for the X-Frame-Options header."
  type        = string
  default     = "SAMEORIGIN"

  validation {
    condition     = contains(["DENY", "SAMEORIGIN"], var.x_frame_options)
    error_message = "Invalid value for x_frame_options"
  }
}

variable "x_xss_protection" {
  description = "The value for the X-XSS-Protection header."
  type        = string
  default     = "1; mode=block"

  validation {
    condition     = contains(["0", "1", "1; mode=block"], var.x_xss_protection)
    error_message = "Invalid value for x_xss_protection"
  }
}

variable "x_content_type_options_enabled" {
  description = "Whether X-Content-Type-Options should be set to nosniff"
  type        = bool
  default     = true
}

variable "cors_enabled" {
  description = "Whether to enable CORS response handling in NGINX"
  type        = bool
  default     = false
}

variable "cors_exposed_headers" {
  description = "The headers to expose in CORS responses"
  type        = string
  default     = "*"
}

variable "cors_allowed_methods" {
  description = "The methods to allow on CORS requests"
  type        = string
  default     = "GET,HEAD,POST,OPTIONS,PUT,PATCH,DELETE"
}

variable "cors_max_age_seconds" {
  description = "Controls how long the CORS preflight requests are allowed to be cached"
  type        = number
  default     = 60 * 60 * 24
}

variable "cors_allowed_origins_self" {
  description = "Whether the ingress domains should be allowed origins on CORS requests"
  type        = bool
  default     = true
}

variable "cors_allowed_origins_subdomains" {
  description = "Whether subdomains of the ingress domains should be allowed origins on CORS requests"
  type        = bool
  default     = true
}

variable "cors_allowed_origins_sibling_domains" {
  description = "Whether sibling domains of the ingress domains should be allowed origins on CORS requests"
  type        = bool
  default     = true
}

variable "cors_extra_allowed_origins" {
  description = "Extra origins allowed on CORS requests"
  type        = list(string)
  default     = []
}

variable "cors_extra_allowed_headers" {
  description = "Extra headers to allow on CORS requests"
  type        = list(string)
  default     = []
}

variable "extra_response_headers" {
  description = "A key-value mapping of extra headers to add to every response"
  type        = map(string)
  default     = {}
}