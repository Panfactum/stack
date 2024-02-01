terraform {
  required_providers {}
}

locals {
  kube_labels = merge({
    app         = var.app,
    module      = var.module,
    environment = var.environment,
    version_tag = var.version_tag,
    region      = var.region
  }, var.additional_labels)
}