provider "helm" {
  kubernetes {
    host           = var.kube_api_server
    config_context = var.kube_config_context
  }
  experiments {
    manifest = true
  }
}