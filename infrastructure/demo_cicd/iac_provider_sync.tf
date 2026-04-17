locals {
  iac_provider_sync_name = "iac-provider-sync"
}

resource "kubernetes_config_map" "iac_provider_sync_scripts" {
  metadata {
    name      = "${local.iac_provider_sync_name}-scripts"
    namespace = local.namespace
    labels    = module.iac_provider_sync_workflow.labels
  }
  data = {
    "sync.sh" = file("${path.module}/iac_provider_sync/sync.sh")
  }
}

module "iac_provider_sync_workflow" {
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name                    = local.iac_provider_sync_name
  namespace               = local.namespace
  burstable_nodes_enabled = true
  active_deadline_seconds = 60 * 30 # 30 minutes

  entrypoint = "sync"
  passthrough_parameters = [
    {
      name        = "git_ref"
      description = "Commit SHA from panfactum/stack to sync"
      default     = "main"
    }
  ]

  common_env = {
    SOURCE_REPO    = "github.com/panfactum/stack"
    DEST_REPO      = "github.com/Panfactum/terraform-provider-pf"
    GIT_USERNAME   = var.github_username
    GIT_REF        = "{{inputs.parameters.git_ref}}"
    SOURCE_SUBPATH = "packages/iac-provider"
  }
  common_secrets = {
    SOURCE_GIT_PASSWORD = var.github_token
    DEST_GIT_PASSWORD   = var.github_token
  }

  default_container_image = local.ci_image

  templates = [
    {
      name = "sync"
      dag = {
        tasks = [
          {
            name     = "sync-step"
            template = "sync-step"
          }
        ]
      }
    },
    {
      name    = "sync-step"
      volumes = module.iac_provider_sync_workflow.volumes
      container = {
        command = ["/bin/bash", "/scripts/sync.sh"]
      }
    }
  ]

  tmp_directories = {
    code = {
      mount_path = "/code"
      size_mb    = 512
    }
  }
  config_map_mounts = {
    "${kubernetes_config_map.iac_provider_sync_scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }
}

resource "kubectl_manifest" "iac_provider_sync_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "WorkflowTemplate"
    metadata = {
      name      = local.iac_provider_sync_name
      namespace = local.namespace
      labels    = module.iac_provider_sync_workflow.labels
    }
    spec = module.iac_provider_sync_workflow.workflow_spec
  })
  server_side_apply = true
  force_conflicts   = true
}

output "iac_provider_sync_workflow_name" {
  description = "The name of the iac-provider-sync WorkflowTemplate"
  value       = module.iac_provider_sync_workflow.name
}

output "iac_provider_sync_workflow_generate_name" {
  description = "The generate_name prefix for the iac-provider-sync WorkflowTemplate"
  value       = module.iac_provider_sync_workflow.generate_name
}