terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
  }
}

locals {

  name             = "jetstream-testing"
  namespace        = module.namespace.namespace
  username         = "client"
  cluster_username = "user"
  js_username      = "js-user"
  pw               = "password"

}

module "namespace" {
  source    = "github.com/Panfactum/stack.git//packages/infrastructure/kube_namespace?ref=dfa23313b6748c957f95af6eb1a322e0fe170f12" # pf-update
  namespace = local.name

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

resource "helm_release" "nats" {
  namespace       = local.namespace
  name            = "nats"
  repository      = "oci://registry-1.docker.io/bitnamicharts"
  chart           = "nats"
  version         = "8.4.5"
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  # The NATS configuration below is being overwritten by the nats-server.conf in this folder. This was termporary test getting a connection to NATS up
  values = [
    yamlencode({
      global = {
        defaultStorageClass = "ebs-standard"
      }
      auth = {
        enabled  = true
        user     = local.username
        password = local.pw
      }
      cluster = {
        auth = {
          enabled  = true
          user     = local.cluster_username
          password = local.pw
        }
      }
      jetstream = {
        enabled   = true
        maxMemory = "1G"
      }
      persistence = {
        enabled = true
        size    = "1Gi"
      }
      replicaCount = 3
      tolerations = [
        {
          key      = "arm64"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        },
        {
          key      = "spot"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        },
        {
          key      = "burstable"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        }
      ]
      configuration = file("nats-server.conf")
      podAnnotations = {
        "config.linkerd.io/opaque-ports" = "4222" # Add 6222 here to break the clustering behavior
      }
    })
  ]
}

resource "kubernetes_secret" "nats_auth" {
  metadata {
    name      = "nats-auth"
    namespace = local.namespace
  }

  data = {
    client-auth = "username: ${local.js_username}\npassword: ${local.pw}"
  }
}

resource "kubectl_manifest" "event_bus" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "EventBus"
    metadata = {
      name      = "default"
      namespace = local.namespace
    }
    spec = {
      jetstreamExotic = {
        url = "nats://nats.${local.namespace}.svc.cluster.local:4222"
        accessSecret = {
          name = kubernetes_secret.nats_auth.metadata[0].name
          key  = "client-auth"
        }
        streamConfig = ""
      }
    }
  })
  depends_on = [helm_release.nats]
}

/*
module "event_source" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure//kube_argo_event_source?ref=dfa23313b6748c957f95af6eb1a322e0fe170f12" #pf-update

  name        = "jetstream-webhook"
  namespace   = local.namespace
  vpa_enabled = true

  replicas = 2

  event_source_spec = {

    webhook = {
      default = {
        endpoint = "/event"
        port     = "12000"
        method   = "POST"
        url      = "https://jetstream.uat.hudsonts.com"
      }
    }

    service = {
      ports = [
        {
          name       = "default"
          port       = 12000
          targetPort = 12000
        }
      ]
    }
  }

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
  depends_on = [kubectl_manifest.event_bus]
}

module "ingress" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure//kube_ingress?ref=dfa23313b6748c957f95af6eb1a322e0fe170f12" # pf-update

  namespace = local.namespace
  name      = "jetstream-webhook"
  ingress_configs = [{
    domains      = ["jetstream.uat.hudsonts.com"]
    service      = "jetstream-webhook-eventsource-svc"
    service_port = 12000
  }]
  rate_limiting_enabled = true

  # These are unnecessary here b/c no browser access
  cross_origin_isolation_enabled = false
  permissions_policy_enabled     = false
  csp_enabled                    = false

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
  depends_on = [kubectl_manifest.event_bus]
}
/*
module "sensor" {
  source = "github.com/Panfactum/stack.git//packages//infrastructure//kube_argo_sensor?ref=dfa23313b6748c957f95af6eb1a322e0fe170f12" #pf-update

  name        = "jetstream-webhook"
  namespace   = local.namespace
  vpa_enabled = true

  dependencies = [
    {
      name            = "test"
      eventSourceName = "jetstream-webhook"
      eventName       = "default" # This is the name of the source in the EventSource spec (i.e., the name of the webhook in this particular example)
      filters = {}
    }
  ]

  triggers = [
    {
      template = {
        conditions = "test"

        name = "log"
        log = {
          intervalSeconds = 1
        }
      }
    }
  ]

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
  depends_on = [kubectl_manifest.event_bus]
}
*/