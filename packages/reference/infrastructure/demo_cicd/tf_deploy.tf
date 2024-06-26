locals {
  tf_deploy_name = "tf-deploy"
}


#############################################################
# AWS Permissions
#############################################################

data "aws_iam_policy_document" "tf_deploy_ecr" {
  statement {
    sid = "CIAdmin"
    effect = "Allow"
    actions = ["*"]
    resources = ["*"]
  }
}

#############################################################
# Kubernetes Permissions
#############################################################


resource "kubernetes_cluster_role_binding" "tf_deploy" {
  metadata {
    generate_name = local.tf_deploy_name
    labels        = module.tf_deploy_workflow.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.tf_deploy_workflow.service_account_name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "cluster-admin"
  }
}

#############################################################
# Vault Permissions
#############################################################

data "vault_policy_document" "tf_deploy_vault_permissions" {
  rule {
    path         = "*"
    capabilities = ["sudo", "create", "read", "update", "patch", "delete", "list"]
    description  = "allow all"
  }
}

module "tf_deploy_vault_role" {
  source                    = "../../../../../infrastructure//kube_sa_auth_vault" #pf-update

  service_account = module.tf_deploy_workflow.service_account_name
  service_account_namespace = local.namespace
  vault_policy_hcl = data.vault_policy_document.tf_deploy_vault_permissions.hcl
  token_ttl_seconds = 60 * 60
}

#############################################################
# Workflow
#############################################################

# These define our workflow scripts
resource "kubernetes_config_map" "tf_deploy_scripts" {
  metadata {
    name = "${local.tf_deploy_name}-scripts"
    labels = module.tf_deploy_workflow.labels
    namespace = local.namespace
  }
  data = {
    "deploy.sh" = file("${path.module}/tf_deploy/deploy.sh")
  }
}

module "tf_deploy_workflow" {
  source                    = "../../../../../infrastructure//kube_workflow" #pf-update

  name = local.tf_deploy_name
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  burstable_nodes_enabled = true
  arm_nodes_enabled = true
  panfactum_scheduler_enabled = true
  active_deadline_seconds = 60 * 60

  entrypoint = "deploy"
  arguments = {
    parameters = [
      {
        name = "git_ref"
        description = "Which commit to check out and deploy in the panfactum/stack repository"
        default = "main"
      }
    ]
  }
  common_env = {
    GIT_REF = "{{workflow.parameters.git_ref}}"
    PF_REPO_URL = "github.com/panfactum/stack"
    PF_IAC_DIR = "infrastructure"
    PF_ENVIRONMENTS_DIR = "environments"
    PF_REPO_PRIMARY_BRANCH = "main"
    PF_REPO_NAME = "stack"
    TF_APPLY_DIR= "environments/production/us-east-2"
    DEVENV_ROOT = "/code/stack/packages/reference"
    VAULT_ROLE = module.tf_deploy_vault_role.role_name
    VAULT_ADDR = "http://vault-active.vault.svc.cluster.local:8200"
    TF_PLUGIN_CACHE_DIR="/tmp/.terraform"
    AWS_CONFIG_FILE="/.aws/config"
    CI="true"
  }
  extra_aws_permissions = data.aws_iam_policy_document.tf_deploy_ecr.json
  default_resources = {
    requests = {
      memory = "2000Mi"
      cpu = "100m"
    }
    limits = {
      memory = "2000Mi"
    }
  }
  default_container_image = local.ci_image
  templates = [
    {
      name = "deploy"
     # affinity = module.tf_deploy_workflow.affinity TODO
      tolerations = module.tf_deploy_workflow.tolerations
      volumes = module.tf_deploy_workflow.volumes
      container = merge(module.tf_deploy_workflow.container_defaults, {
          command = ["/scripts/deploy.sh"]
      })
    },
    {
      name = "unlock"
      # affinity = module.tf_deploy_workflow.affinity TODO
      tolerations = module.tf_deploy_workflow.tolerations
      volumes = module.tf_deploy_workflow.volumes
      container = merge(module.tf_deploy_workflow.container_defaults, {
        command = ["/scripts/deploy.sh"]
      })
    }
  ]
  tmp_directories = {
    code = {
      mount_path = "/code"
      size_mb = 1000
    }
    aws = {
      mount_path = "/.aws"
      size_mb = 10
      node_local = true
    }
    kube = {
      mount_path = "/.kube"
      size_mb = 10
      node_local = true
    }
    tmp = {
      mount_path = "/tmp"
      size_mb = 3000
    }
    cache = {
      mount_path = "/.cache" # This folder needed by terragrunt event though it is never used
      size_mb = 10
      node_local = true
    }
  }
  config_map_mounts = {
    "${kubernetes_config_map.tf_deploy_scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }
  secrets = {
    AUTHENTIK_TOKEN = var.authentik_token
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
    kind = "WorkflowTemplate"
    metadata = {
      name = local.tf_deploy_name
      namespace = local.namespace
      labels = module.tf_deploy_workflow.labels
    }
    spec = module.tf_deploy_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}

