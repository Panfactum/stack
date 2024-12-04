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
      version = "5.70.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  entrypoint = "entry"
  args = {

  }
}

module "constants" {
  source = "../kube_constants"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

#############################################################
# Kubernetes Permissions
#
# Binding to the 'buildkit-user` role in the 'buildkit'
# namespace gives the Workflow's ServiceAccount permissions
# to scale BuildKit, select a BuildKit instance, and record
# builds
#############################################################

resource "kubernetes_role_binding" "image_builder" {
  metadata {
    generate_name = var.name
    namespace     = "buildkit"
    labels        = module.image_builder_workflow.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.image_builder_workflow.service_account_name
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = "buildkit-user"
  }
}

#############################################################
# AWS Permissions
#
# This policy gives the Workflow the ability to upload
# and download images from the repository
#############################################################

data "aws_iam_policy_document" "image_builder" {
  statement {
    sid    = "PrivateECR"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:ListImages",
      "ecr:PutImage",
      "ecr:UploadLayerPart"
    ]
    resources = [
      "arn:aws:ecr:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:repository/${var.image_repo}"
    ]
  }
  statement {
    sid       = "PrivateECRAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
}

#############################################################
# Workflow
#############################################################

data "kubernetes_config_map" "buildkit_bucket" {
  metadata {
    name      = "buildkit-cache-bucket-config"
    namespace = "buildkit"
  }
}

# These define our workflow scripts
resource "kubernetes_config_map" "scripts" {
  metadata {
    name      = "${var.name}-scripts"
    labels    = module.image_builder_workflow.labels
    namespace = var.namespace
  }
  data = {
    "build.sh"           = file("${path.module}/scripts/build.sh")
    "clone.sh"           = file("${path.module}/scripts/clone.sh")
    "merge-manifests.sh" = file("${path.module}/scripts/merge-manifests.sh")
  }
}

module "image_builder_workflow" {
  source = "../wf_spec"

  name                    = var.name
  namespace               = var.namespace
  eks_cluster_name        = var.eks_cluster_name
  burstable_nodes_enabled = true
  active_deadline_seconds = var.build_timeout
  workflow_parallelism    = 10

  entrypoint = local.entrypoint
  passthrough_parameters = [
    {
      name        = "git_ref"
      description = "Which commit to check out and build in the ${var.code_repo} repository"
      default     = var.git_ref
    }
  ]
  common_env = {
    GIT_REF                = "{{inputs.parameters.git_ref}}"
    GIT_USERNAME           = var.git_username
    CODE_REPO              = var.code_repo
    IMAGE_REPO             = var.image_repo
    IMAGE_REGISTRY         = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
    IMAGE_REGION           = data.aws_region.current.name
    PUSH_IMAGE             = tostring(var.push_image_enabled)
    BUILD_CONTEXT          = var.build_context
    DOCKERFILE_PATH        = var.dockerfile_path
    BUILDKIT_BUCKET_NAME   = data.kubernetes_config_map.buildkit_bucket.data.bucket
    BUILDKIT_BUCKET_REGION = data.aws_region.current.name
    SECRET_ARGS            = join(" ", [for id, val in var.secrets : "--secret id=${id},env=${id}"])
    BUILD_ARGS             = join(" ", [for arg, val in var.args : "--opt build-arg:${arg}=${val}"])
  }
  common_secrets = merge(
    var.secrets,
    {
      GIT_PASSWORD = var.git_password
    }
  )
  extra_aws_permissions = data.aws_iam_policy_document.image_builder.json
  default_resources = {
    requests = {
      memory = "25Mi"
      cpu    = "25m"
    }
    limits = {
      memory = "100Mi"
    }
  }
  default_container_image = "${module.constants.images.devShell.registry}/${module.constants.images.devShell.repository}:${module.constants.images.devShell.tag}"
  templates = [
    {
      name    = local.entrypoint
      volumes = module.image_builder_workflow.volumes
      containerSet = {
        containers = [
          {
            name    = "scale-buildkit"
            command = ["/bin/pf-buildkit-scale-up", "--wait"]
          },
          {
            name    = "clone"
            command = ["/scripts/clone.sh"]
          },
          {
            name    = "build-amd64"
            command = ["/scripts/build.sh"]
            env = concat(
              module.image_builder_workflow.env,
              [
                { name = "ARCH", value = "amd64" },
                { name = "IMAGE_TAG_PREFIX", value = var.image_tag_prefix }
              ]
            )
            dependencies = ["scale-buildkit", "clone"]
          },
          {
            name    = "build-arm64"
            command = ["/scripts/build.sh"]
            env = concat(
              module.image_builder_workflow.env,
              [
                { name = "ARCH", value = "arm64" },
                { name = "IMAGE_TAG_PREFIX", value = var.image_tag_prefix }
              ]
            )
            dependencies = ["scale-buildkit", "clone"]
          },
          {
            name         = "merge-manifests"
            command      = ["/scripts/merge-manifests.sh"]
            dependencies = ["build-arm64", "build-amd64"]
            env = concat(
              module.image_builder_workflow.env,
              [
                { name = "ARCH", value = "arm64" },
                { name = "IMAGE_TAG_PREFIX", value = var.image_tag_prefix }
              ]
            )
          }
        ]
      }
    }
  ]
  tmp_directories = {
    code = {
      mount_path = "/code"
      size_mb    = 1024
    }
    creds = {
      mount_path = "/.docker"
      size_mb    = 10
      node_local = true
    }
    aws = {
      mount_path = "/.aws"
      size_mb    = 10
      node_local = true
    }
  }
  config_map_mounts = {
    "${kubernetes_config_map.scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }
}

resource "kubectl_manifest" "workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "WorkflowTemplate"
    metadata = {
      name      = var.name
      namespace = var.namespace
      labels    = module.image_builder_workflow.labels
    }
    spec = module.image_builder_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}

