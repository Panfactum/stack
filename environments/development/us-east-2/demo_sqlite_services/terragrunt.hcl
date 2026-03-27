include "panfactum" {
  path = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source
}

dependency "ingress" {
  config_path  = "../kube_ingress_nginx"
  skip_outputs = true
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  namespace = "demo-sqlite-services"

  statefulsets = {
    n8n = {
      image_registry    = "docker.n8n.io"
      image_repository  = "n8nio/n8n"
      image_tag         = "1.94.0"
      domains = ["n8n.dev.panfactum.com"]
      healthcheck_route = "/health"
      mount_path        = "/home/node/.n8n"
      port              = 5678
      minimum_memory    = 200

      env = {
        WEBHOOK_URL  = "https://n8n.dev.panfactum.com"
        N8N_HOST     = "n8n.dev.panfactum.com"
        N8N_PROTOCOL = "http"
        N8N_PORT     = 5678
        N8N_RUNNERS_ENABLED = true
      }
    }
  }
}