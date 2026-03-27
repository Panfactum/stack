locals {
  installer_uploader_workflow_name = "installer-uploader"
}

#############################################################
# AWS Permissions
#############################################################

data "aws_iam_policy_document" "installer_uploader" {
  statement {
    sid    = "Uploader"
    effect = "Allow"
    actions = [
      "s3:*"
    ]
    resources = [
      "arn:aws:s3:::${var.installer_bucket}",
      "arn:aws:s3:::${var.installer_bucket}/*"
    ]
  }
}


#############################################################
# Workflow
#############################################################

# These define our workflow scripts
resource "kubernetes_config_map" "installer_uploader_scripts" {
  metadata {
    name      = "${local.installer_uploader_workflow_name}-scripts"
    labels    = module.installer_uploader_workflow.labels
    namespace = local.namespace
  }
  data = {
    "upload.sh" = file("${path.module}/installer_uploader/upload.sh")
  }
}

module "installer_uploader_workflow" {
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name                    = local.installer_uploader_workflow_name
  namespace               = local.namespace
  active_deadline_seconds = 60 * 10
  workflow_parallelism    = 10
  burstable_nodes_enabled = true

  entrypoint = "upload-installer"
  arguments = {
    parameters = [
      {
        name        = "git_ref"
        description = "Which git reference to check out and upload modules from."
        default     = "main"
      },
      {
        name        = "is_tag"
        description = "Whether the git reference is a tag."
        default     = "0"
      }
    ]
  }
  common_env = {
    IS_TAG      = "{{workflow.parameters.is_tag}}"
    GIT_REF     = "{{workflow.parameters.git_ref}}"
    GIT_REPO    = "github.com/panfactum/stack.git"
    BUCKET_NAME = var.installer_bucket
  }
  extra_aws_permissions = data.aws_iam_policy_document.installer_uploader.json
  default_resources = {
    requests = {
      memory = "25Mi"
      cpu    = "25m"
    }
    limits = {
      memory = "100Mi"
    }
  }
  default_container_image = local.ci_image
  templates = [
    {
      name = "upload-installer"
      container = {
        command = ["/scripts/upload.sh"]
      }
    }
  ]
  tmp_directories = {
    code = {
      mount_path = "/code"
      size_mb    = 1024
    }
    aws = {
      mount_path = "/.aws"
      size_mb    = 10
      node_local = true
    }
  }
  config_map_mounts = {
    "${kubernetes_config_map.installer_uploader_scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }
}

resource "kubectl_manifest" "installer_uploader_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "WorkflowTemplate"
    metadata = {
      name      = local.installer_uploader_workflow_name
      namespace = local.namespace
      labels    = module.installer_uploader_workflow.labels
    }
    spec = module.installer_uploader_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}

