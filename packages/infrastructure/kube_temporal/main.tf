terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.35.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.6"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.8.1"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.8.0"
    }
    aws = {
      source                = "hashicorp/aws"
      version               = "6.38.0"
      configuration_aliases = [aws.global]
    }
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_temporal"
}

data "pf_metadata" "metadata" {}

resource "random_id" "id" {
  byte_length = 2
  prefix      = "temporal-"
}

locals {
  name            = random_id.id.hex
  namespace       = module.namespace.namespace
  db_connect_addr = "${split(".", module.database.rw_service_name)[0]}.${local.namespace}.svc.cluster.local:${module.database.rw_service_port}"
  frontend_addr   = "temporal-frontend.${local.namespace}.svc.cluster.local:7233"
}

module "namespace" {
  source = "../kube_namespace"

  namespace          = "temporal"
  monitoring_enabled = var.monitoring_enabled
}

/***************************************
* Shared ConfigMaps
***************************************/

resource "kubernetes_config_map_v1" "scripts" {
  metadata {
    name      = "${local.name}-scripts"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  data = {
    "schema-init.sh"    = file("${path.module}/scripts/schema-init.sh")
    "render-config.sh"  = file("${path.module}/scripts/render-config.sh")
    "namespace-init.sh" = file("${path.module}/scripts/namespace-init.sh")
  }
}

resource "kubernetes_config_map_v1" "temporal_config_template" {
  metadata {
    name      = "${local.name}-config-template"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  data = {
    "config.yaml" = yamlencode({
      log = {
        stdout = true
        level  = var.log_level
      }
      persistence = {
        defaultStore     = "default"
        visibilityStore  = "visibility"
        numHistoryShards = var.num_history_shards
        datastores = {
          default = {
            sql = {
              pluginName      = "postgres12"
              databaseName    = "app"
              connectAddr     = local.db_connect_addr
              connectProtocol = "tcp"
              user            = "@DB_USER@"
              password        = "@DB_PASSWORD@"
              maxConns        = 20
              maxIdleConns    = 20
              maxConnLifetime = "1h"
              tls = {
                enabled = false
              }
              connectAttributes = {
                search_path = "temporal"
              }
            }
          }
          visibility = {
            sql = {
              pluginName      = "postgres12"
              databaseName    = "app"
              connectAddr     = local.db_connect_addr
              connectProtocol = "tcp"
              user            = "@DB_USER@"
              password        = "@DB_PASSWORD@"
              maxConns        = 10
              maxIdleConns    = 10
              maxConnLifetime = "1h"
              tls = {
                enabled = false
              }
              connectAttributes = {
                search_path = "temporal_visibility"
              }
            }
          }
        }
      }
      global = {
        membership = {
          maxJoinDuration  = "30s"
          broadcastAddress = "@POD_IP@"
        }
        pprof = {
          port = 7936
        }
      }
      services = {
        frontend = {
          rpc = {
            grpcPort       = 7233
            membershipPort = 6933
            bindOnIP       = "0.0.0.0"
          }
        }
        history = {
          rpc = {
            grpcPort       = 7234
            membershipPort = 6934
            bindOnIP       = "0.0.0.0"
          }
        }
        matching = {
          rpc = {
            grpcPort       = 7235
            membershipPort = 6935
            bindOnIP       = "0.0.0.0"
          }
        }
        worker = {
          rpc = {
            grpcPort       = 7239
            membershipPort = 6939
            bindOnIP       = "0.0.0.0"
          }
        }
        internalFrontend = {
          rpc = {
            grpcPort       = 7236
            membershipPort = 6936
            bindOnIP       = "0.0.0.0"
          }
        }
      }
      clusterMetadata = {
        enableGlobalNamespace    = false
        failoverVersionIncrement = 10
        masterClusterName        = "active"
        currentClusterName       = "active"
        clusterInformation = {
          active = {
            enabled                = true
            initialFailoverVersion = 1
            rpcName                = "frontend"
            rpcAddress             = "127.0.0.1:7233"
          }
        }
      }
      dcRedirectionPolicy = {
        policy = "noop"
      }
      archival = {
        history = {
          state = "disabled"
        }
        visibility = {
          state = "disabled"
        }
      }
      publicClient = {
        hostPort = local.frontend_addr
      }
      dynamicConfigClient = {
        filepath     = "/etc/temporal/dynamic_config/dynamic_config.yaml"
        pollInterval = "10s"
      }
    })
  }
}

resource "kubernetes_config_map_v1" "temporal_dynamic_config" {
  metadata {
    name      = "${local.name}-dynamic-config"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  data = {
    "dynamic_config.yaml" = yamlencode({
      "frontend.rps" = [{
        value       = 2400
        constraints = {}
      }]
      "limit.maxIDLength" = [{
        value       = 255
        constraints = {}
      }]
      "system.forceSearchAttributesCacheRefreshOnRead" = [{
        value       = true
        constraints = {}
      }]
    })
  }
}
