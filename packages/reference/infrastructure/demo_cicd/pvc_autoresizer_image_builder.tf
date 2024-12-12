locals {
  pvc_autoresizer_image_name = "pvc-autoresizer-builder"
}


#############################################################
# Kubernetes Permissions
#
# Binding to the 'buildkit-user` role in the 'buildkit'
# namespace gives the Workflow's ServiceAccount permissions
# to scale BuildKit, select a BuildKit instance, and record
# builds
#############################################################


resource "kubernetes_role_binding" "pvc_autoresizer_builder" {
  metadata {
    generate_name      = local.nix_image_builder_name
    namespace = "buildkit"
    labels    = module.pvc_autoresizer_image_builder_workflow.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.pvc_autoresizer_image_builder_workflow.service_account_name
    namespace = local.namespace
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

data "aws_iam_policy_document" "pvc_autoresizer_builder_ecr" {
  statement {
    sid = "PrivateECR"
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
      "arn:aws:ecr:us-east-2:891377197483:repository/pvc-autoresizer"
    ]
  }
  statement {
    sid = "PrivateECRAuth"
    effect = "Allow"
    actions = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "PublicECR"
    effect = "Allow"
    actions = [
      "ecr-public:BatchCheckLayerAvailability",
      "ecr-public:BatchGetImage",
      "ecr-public:CompleteLayerUpload",
      "ecr-public:DescribeImages",
      "ecr-public:DescribeRepositories",
      "ecr-public:GetDownloadUrlForLayer",
      "ecr-public:InitiateLayerUpload",
      "ecr-public:ListImages",
      "ecr-public:PutImage",
      "ecr-public:UploadLayerPart"
    ]
    resources = [
      "arn:aws:ecr-public::891377197483:repository/pvc-autoresizer"
    ]
  }
  statement {
    sid = "PublicECRAuth"
    effect = "Allow"
    actions = [
      "ecr-public:GetAuthorizationToken",
      "sts:GetServiceBearerToken"
    ]
    resources = ["*"]
  }
}


#############################################################
# Workflow
#############################################################

# These define our workflow scripts
resource "kubernetes_config_map" "pvc_autoresizer_image_builder_scripts" {
  metadata {
    name = "${local.pvc_autoresizer_image_name}-scripts"
    labels = module.pvc_autoresizer_image_builder_workflow.labels
    namespace = local.namespace
  }
  data = {
    "build.sh" = file("${path.module}/pvc_autoresizer_image_builder/build.sh")
    "clone.sh" = file("${path.module}/pvc_autoresizer_image_builder/clone.sh")
    "merge-manifests.sh" = file("${path.module}/pvc_autoresizer_image_builder/merge-manifests.sh")
    "copy-to-public.sh" = file("${path.module}/pvc_autoresizer_image_builder/copy-to-public.sh")
  }
}

# This configuration is required by skopeo
resource "kubernetes_config_map" "pvc_autoresizer_image_builder_containers" {
  metadata {
    name = "${local.pvc_autoresizer_image_name}-containers"
    labels = module.pvc_autoresizer_image_builder_workflow.labels
    namespace = local.namespace
  }
  data = {
    "policy.json" = file("${path.module}/pvc_autoresizer_image_builder/policy.json")
  }
}

module "pvc_autoresizer_image_builder_workflow" {
  source                    = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name = local.pvc_autoresizer_image_name
  namespace = local.namespace
  active_deadline_seconds = 60 * 60

  entrypoint = "build-images"
  arguments = {
    parameters = [
      {
        name = "git_ref"
        description = "Which commit to check out and build in the panfactum/stack repository"
        default = "main"
      }
    ]
  }
  common_env = {
    GIT_REF = "{{workflow.parameters.git_ref}}"
    IMAGE_REPO = "pvc-autoresizer"
    PUBLIC_IMAGE_REGISTRY = "public.ecr.aws/t8f0s7h5"
    IMAGE_REGISTRY = "891377197483.dkr.ecr.us-east-2.amazonaws.com"
    IMAGE_REGION = "us-east-2"
    PUSH_IMAGE = "true"
    BUILDKIT_BUCKET_NAME = var.buildkit_bucket_name
    BUILDKIT_BUCKET_REGION = var.buildkit_bucket_region
  }
  extra_aws_permissions = data.aws_iam_policy_document.pvc_autoresizer_builder_ecr.json
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
      name = "build-images"
      containerSet = {
        containers = [
          {
            name = "scale-buildkit"
            command = ["/bin/pf-buildkit-scale-up", "--wait"]
          },
          {
            name = "clone"
            command = ["/scripts/clone.sh"]
          },
          {
            name = "build-amd64"
            command = ["/scripts/build.sh"]
            env = concat(
              module.pvc_autoresizer_image_builder_workflow.env,
              [
                { name = "ARCH", value = "amd64" }
              ]
            )
            dependencies = ["scale-buildkit", "clone"]
          },
          {
            name = "build-arm64"
            command = ["/scripts/build.sh"]
            env = concat(
              module.pvc_autoresizer_image_builder_workflow.env,
              [
                { name = "ARCH", value = "arm64" }
              ]
            )
            dependencies = ["scale-buildkit", "clone"]
          },
          {
            name = "merge-manifests"
            command = [ "/scripts/merge-manifests.sh"]
            dependencies = ["build-arm64", "build-amd64"]
          },
          {
            name = "copy-to-public-ecr"
            command = [ "/scripts/copy-to-public.sh"]
            dependencies = ["merge-manifests"]
          }
        ]
      }
    }
  ]
  tmp_directories = {
    code = {
      mount_path = "/code"
      size_mb = 1024
    }
    creds = {
      mount_path = "/.docker"
      size_mb = 10
      node_local = true
    }
    aws = {
      mount_path = "/.aws"
      size_mb = 10
      node_local = true
    }
  }
  config_map_mounts = {
    "${kubernetes_config_map.pvc_autoresizer_image_builder_scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
    "${kubernetes_config_map.pvc_autoresizer_image_builder_containers.metadata[0].name}" = {
      mount_path = "/etc/containers"
    }
  }
}

resource "kubectl_manifest" "pvc_autoresizer_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind = "WorkflowTemplate"
    metadata = {
      name = local.pvc_autoresizer_image_name
      namespace = local.namespace
      labels = module.pvc_autoresizer_image_builder_workflow.labels
    }
    spec = module.pvc_autoresizer_image_builder_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}

