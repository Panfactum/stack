variable "azuread_tenant_id" {
  description = "The AD tenant ID to use"
  type        = string
}

variable "aad_sp_object_owners" {
  description = "The object ids for service principals that should own objects created in AAD"
  type = list(string)
}

provider "azuread" {
  tenant_id = var.azuread_tenant_id
}
