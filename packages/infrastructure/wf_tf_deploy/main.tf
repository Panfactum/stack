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
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

locals {
  # Use this as a consistent hostname so that force-unlock can work between
  # workflow runs
  hostname = md5("${var.repo}${var.tf_apply_dir}")
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "constants" {
  source = "../kube_constants"
}

#############################################################
# AWS Permissions
#
# Should have full access to the AWS account as must be able to make
# arbitrary changes.
#############################################################

data "aws_iam_policy_document" "tf_deploy_ecr" {
  statement {
    sid       = "CIAdmin"
    effect    = "Allow"
    actions   = ["*"]
    resources = ["*"]
  }
}

#############################################################
# Kubernetes Permissions
#
# Should have full access to Kubernetes as must be able to make
# arbitrary changes.
#############################################################


resource "kubernetes_cluster_role_binding" "tf_deploy" {
  metadata {
    generate_name = var.name
    labels        = module.tf_deploy_workflow.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.tf_deploy_workflow.service_account_name
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "cluster-admin"
  }
}

#############################################################
# Vault Permissions
#
# Should have full access to Vault as must be able to make
# arbitrary changes.
#############################################################

data "vault_policy_document" "tf_deploy_vault_permissions" {
  rule {
    path         = "*"
    capabilities = ["sudo", "create", "read", "update", "patch", "delete", "list"]
    description  = "allow all"
  }
}

module "tf_deploy_vault_role" {
  source = "../kube_sa_auth_vault"

  service_account           = module.tf_deploy_workflow.service_account_name
  service_account_namespace = var.namespace
  vault_policy_hcl          = data.vault_policy_document.tf_deploy_vault_permissions.hcl
  token_ttl_seconds         = 60 * 60
}

#############################################################
# Workflow
#############################################################

# These define our workflow scripts
resource "kubernetes_config_map" "tf_deploy_scripts" {
  metadata {
    name      = "${var.name}-scripts"
    labels    = module.tf_deploy_workflow.labels
    namespace = var.namespace
  }
  data = {
    "deploy.sh"       = file("${path.module}/scripts/deploy.sh")
    "force-unlock.sh" = file("${path.module}/scripts/force-unlock.sh")
  }
}

module "tf_deploy_workflow" {
  source = "../wf_spec"

  name                        = var.name
  namespace                   = var.namespace
  eks_cluster_name            = var.eks_cluster_name
  burstable_nodes_enabled     = true
  arm_nodes_enabled           = true
  panfactum_scheduler_enabled = true
  active_deadline_seconds     = 60 * 60

  entrypoint = "dag"
  arguments = {
    parameters = [
      {
        name        = "git_ref"
        description = "Which commit to check out and deploy in the ${var.repo} repository"
        default     = var.git_ref
      }
    ]
  }
  common_env = {
    REPO         = var.repo
    GIT_REF      = "{{workflow.parameters.git_ref}}"
    GIT_USERNAME = var.git_username
    TF_APPLY_DIR = var.tf_apply_dir

    # Needed for Vault authentication
    VAULT_ROLE = module.tf_deploy_vault_role.role_name
    VAULT_ADDR = "http://vault-active.vault.svc.cluster.local:8200"

    # Setup cache anc config directories
    TF_PLUGIN_CACHE_DIR   = "/tmp/.terraform"
    AWS_CONFIG_FILE       = "/.aws/config"
    KUBE_CONFIG_PATH      = "/.kube/config"
    KUBECONFIG            = "/.kube/config"
    HELM_REPOSITORY_CACHE = "/tmp/.helm"
    HELM_CACHE_HOME       = "/tmp/.helm"
    HELM_DATA_HOME        = "/tmp/.helm"

    CI  = "true"               # Required to run the Panfactum terragrunt setup in CI mode
    WHO = "@${local.hostname}" # Use by the force-unlock program to identify locks held by this workflow
  }
  common_secrets = merge(
    var.secrets,
    {
      GIT_PASSWORD = var.git_password
    }
  )
  extra_aws_permissions = data.aws_iam_policy_document.tf_deploy_ecr.json
  default_resources = {
    requests = {
      memory = "${var.memory_mb}Mi"
      cpu    = "${var.cpu_millicores}m"
    }
    limits = {
      memory = "${var.memory_mb}Mi"
    }
  }
  default_container_image = "${module.pull_through.ecr_public_registry}/${module.constants.panfactum_image}:${module.constants.panfactum_image_version}"
  templates = [
    {
      name = "dag"
      dag = {
        tasks = [
          {
            name     = "deploy"
            template = "deploy"
            hooks = {
              # If the deployment fails, it might be due to an OOM or some other abrupt failure.
              # This means that the state locks will not have been released, so we run a clean-up
              # job to release any locks that were generated by this workflow (ONLY locks generated
              # by this workflow).
              #
              # Note: This must run as a hook instead of a separate DAG node in order
              # to not mark the workflow as succeeded if the deploy fails but force-unlock succeeds
              fail = {
                expression = "tasks[\"deploy\"].status == \"Failed\""
                template   = "force-unlock"
              }
            }
          }
        ]
      }
    },
    {
      name = "deploy"
      podSpecPatch = yamlencode({
        hostname = local.hostname
      })
      volumes = module.tf_deploy_workflow.volumes
      container = {
        command = ["/scripts/deploy.sh"]
      }
      # We do not retry this template b/c we need to proceed to force-unlock if this fails
      # unexpectedly. Retry is done via the dag.
      retryStrategy = { limit = "0" }
    },
    {
      name    = "force-unlock"
      volumes = [for volume in module.tf_deploy_workflow.volumes : volume if !contains(["tmp", "cache"], volume.name)]
      container = {
        volumeMounts = [for mount in module.tf_deploy_workflow.container_defaults.volumeMounts : mount if !contains(["tmp", "cache"], mount.name)]
        command      = ["/scripts/force-unlock.sh"]
        resources = {
          requests = {
            memory = "250Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "250Mi"
            cpu    = "100m"
          }
        }
      }
      retryStrategy = { limit = "0" }
    }
  ]
  tmp_directories = {
    code = {
      mount_path = "/code"
      size_mb    = 1000
    }
    aws = {
      mount_path = "/.aws"
      size_mb    = 10
      node_local = true
    }
    kube = {
      mount_path = "/.kube"
      size_mb    = 10
      node_local = true
    }
    tmp = {
      mount_path = "/tmp"
      size_mb    = 3000
    }
    # TODO: I do not think that terragrunt should be utilizing this directory
    # but due to a bug it is so we must provide it. Revisit in a future release.
    cache = {
      mount_path = "/.cache"
      size_mb    = 1000
    }
  }
  config_map_mounts = {
    "${kubernetes_config_map.tf_deploy_scripts.metadata[0].name}" = {
      mount_path = "/scripts"
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
}

resource "kubectl_manifest" "tf_deploy_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "WorkflowTemplate"
    metadata = {
      name      = var.name
      namespace = var.namespace
      labels    = module.tf_deploy_workflow.labels
    }
    spec = module.tf_deploy_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}
