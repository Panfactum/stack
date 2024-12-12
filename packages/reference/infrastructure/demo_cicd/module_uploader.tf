locals {
  module_uploader_workflow_name = "module-uploader"
}

#############################################################
# AWS Permissions
#############################################################

data "aws_iam_policy_document" "module_uploader" {
  statement {
    sid = "Uploader"
    effect = "Allow"
    actions = [
      "s3:*"
    ]
    resources = [
      "arn:aws:s3:::${var.module_bucket}",
      "arn:aws:s3:::${var.module_bucket}/*"
    ]
  }
}


#############################################################
# Workflow
#############################################################

# These define our workflow scripts
resource "kubernetes_config_map" "module_uploader_scripts" {
  metadata {
    name = "${local.module_uploader_workflow_name}-scripts"
    labels = module.module_uploader_workflow.labels
    namespace = local.namespace
  }
  data = {
    "upload.sh" = file("${path.module}/module_uploader/upload.sh")
  }
}

module "module_uploader_workflow" {
  source                    = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name = local.module_uploader_workflow_name
  namespace = local.namespace
  active_deadline_seconds = 60 * 10
  workflow_parallelism = 10
  burstable_nodes_enabled = true

  entrypoint = "upload-modules"
  arguments = {
    parameters = [
      {
        name = "git_ref"
        description = "Which git reference to check out and upload modules from."
        default = "main"
      }
    ]
  }
  common_env = {
    GIT_REF = "{{workflow.parameters.git_ref}}"
    GIT_REPO = "github.com/panfactum/stack.git"
    BUCKET_NAME = var.module_bucket
  }
  extra_aws_permissions = data.aws_iam_policy_document.module_uploader.json
  default_resources = {
    requests = {
      memory = "25Mi"
      cpu = "25m"
    }
    limits = {
      memory = "100Mi"
    }
  }
  default_container_image = local.ci_image
  templates = [
    {
      name = "upload-modules"
      container = {
        command = ["/scripts/upload.sh"]
      }
    }
  ]
  tmp_directories = {
    code = {
      mount_path = "/code"
      size_mb = 1024
    }
    aws = {
      mount_path = "/.aws"
      size_mb = 10
      node_local = true
    }
  }
  config_map_mounts = {
    "${kubernetes_config_map.module_uploader_scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }
}

resource "kubectl_manifest" "module_uploader_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind = "WorkflowTemplate"
    metadata = {
      name = local.module_uploader_workflow_name
      namespace = local.namespace
      labels = module.module_uploader_workflow.labels
    }
    spec = module.module_uploader_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}

