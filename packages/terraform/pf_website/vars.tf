variable "website_image_version" {
  description = "The version of the image to use for the deployment"
  type        = string
  default     = "alpha.2"
}

variable "website_domain" {
  description = "The domain name to use for the website"
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

