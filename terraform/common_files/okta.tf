variable "okta_org_name" {
  description = "The name of the Okta organization."
  type        = string
}

variable "okta_base_url" {
  description = "The base URL of the Okta api."
  type        = string
}

provider "okta" {
  org_name = var.okta_org_name
  base_url = var.okta_base_url
}