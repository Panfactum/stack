variable "kube_api_server" {
  description = "The URL of the API server for this provider."
  type        = string
}

variable "kube_config_context" {
  description = "The context to use in the kubeconfig file."
  type        = string
}

provider "kubernetes" {
  host           = var.kube_api_server
  config_context = var.kube_config_context
  ignore_annotations = [
    "^eks.amazonaws.com\\/.*",                          // Prevents us from overriding annotations made by EKS (e.g., for IRSA)
    "^reloader.stakater.com\\/last-reloaded-from\\/.*", // Ignore the reloader annotations
    "^azure.workload.identity\\/.*",                    // Prevents us from overriding annotations needed to AZWI
    "^panfactum.com\\/.*"                               // Our out-of-band annotations
  ]
}
