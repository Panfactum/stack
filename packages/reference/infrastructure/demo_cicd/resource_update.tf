resource "kubernetes_config_map" "update_test" {
  metadata {
    name = "resource-update-test"
    namespace = local.namespace
  }
  data = {
    last-commit = "x"
  }
  lifecycle {
    ignore_changes = [data]
  }
}

resource "kubernetes_role" "resource_updater" {
  metadata {
    name = "resource-updater"
    namespace = local.namespace
  }
  rule {
    api_groups = [""]
    resources = ["configmaps"]
    verbs = ["update", "get", "patch"]
    resource_names = [kubernetes_config_map.update_test.metadata[0].name]
  }
}

resource "kubernetes_role_binding" "resource_updater" {
  metadata {
    name = "resource-updater"
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.resource_updater.metadata[0].name
  }
  subject {
    kind = "ServiceAccount"
    name = module.resource_update_workflow.service_account_name
    namespace = local.namespace
  }
}

module "resource_update_workflow" {
  source             = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=704512d8ba8e8a6464546b0fedc93720c27de1d9" # pf-update

  name               = "resource-update-demo"
  namespace          = local.namespace
  eks_cluster_name   = var.eks_cluster_name

  passthrough_parameters = [
    {
      name = "data"
      default = "test"
    }
  ]

  entrypoint = "entry"
  templates = [
    {
      name = "entry"
      resource = {
        action = "patch"
        manifest = yamlencode({
          apiVersion = "v1"
          kind = "ConfigMap"
          metadata = {
            name = kubernetes_config_map.update_test.metadata[0].name
            namespace = local.namespace
          }
          data = {
            last-commit = "{{inputs.parameters.data}}"
          }
        })
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
}

resource "kubectl_manifest" "resource_update_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "WorkflowTemplate"
    metadata   = {
      name      = module.resource_update_workflow.name
      namespace = local.namespace
      labels    = module.resource_update_workflow.labels
    }

    spec = module.resource_update_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}
