locals {
  website_astro_builder_name = "website-astro-builder"
}

#############################################################
# Kubernetes Permissions
#
# Binding to the 'buildkit-user` role in the 'buildkit'
# namespace gives the Workflow's ServiceAccount permissions
# to scale BuildKit, select a BuildKit instance, and record
# builds
#############################################################


resource "kubernetes_role_binding" "astro_builder" {
  metadata {
    generate_name      = local.website_astro_builder_name
    namespace = "buildkit"
    labels    = module.astro_builder_workflow.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.astro_builder_workflow.service_account_name
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
# This policy gives the Workflow the ability to upload to the s3 bucket
#############################################################

data "aws_iam_policy_document" "astro_builder" {
  statement {
    sid = "S3Access"
    effect = "Allow"
    actions = [
      "s3:*"
    ]
    resources = [
      "arn:aws:s3:::pf-website-astro/*",
      "arn:aws:s3:::pf-website-astro"
    ]
  }
  statement {
    sid = "CloudfrontInvalidation"
    effect = "Allow"
    actions = ["cloudfront:CreateInvalidation"]
    resources = ["arn:aws:cloudfront::891377197483:distribution/E1BPTEFRQY1PK4"]
  }
}


#############################################################
# Workflow
#############################################################

# These define our workflow scripts
resource "kubernetes_config_map" "astro_builder_scripts" {
  metadata {
    name = "${local.website_astro_builder_name}-scripts"
    labels = module.astro_builder_workflow.labels
    namespace = local.namespace
  }
  data = {
    "build.sh" = file("${path.module}/astro_builder/build.sh")
    "clone.sh" = file("${path.module}/astro_builder/clone.sh")
  }
}

module "astro_builder_workflow" {
  source                    = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name = local.website_astro_builder_name
  namespace = local.namespace
  burstable_nodes_enabled = true
  arm_nodes_enabled = true
  panfactum_scheduler_enabled = true
  active_deadline_seconds = 60 * 60

  entrypoint = "main-dag"
  arguments = {
    parameters = [
      {
        name = "git_ref"
        description = "Which commit to check out and build in the panfactum/stack repository"
        default = "main"
      },

      {
        name = "sitemap_url"
        description = "The URL of the sitemap to scrape"
        default = "https://website2.panfactum.com/sitemap-index.xml"
      },

      {
        name = "algolia_index_name"
        description = "The index name in algolia to update"
        default = "docs-2"
      }
    ]
  }
  common_env = {
    GIT_REF = "{{workflow.parameters.git_ref}}"
    BUILDKIT_BUCKET_NAME = var.buildkit_bucket_name
    BUILDKIT_BUCKET_REGION = var.buildkit_bucket_region
    ALGOLIA_APP_ID = var.algolia_app_id
    ALGOLIA_SEARCH_API_KEY = var.algolia_search_api_key
    ALGOLIA_INDEX_NAME = var.algolia_index_name_2
    SITE_URL = var.site_url
    DISTRIBUTION_ID = "E1BPTEFRQY1PK4"
  }
  extra_aws_permissions = data.aws_iam_policy_document.astro_builder.json
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
      tolerations = module.astro_builder_workflow.tolerations
      volumes = module.astro_builder_workflow.volumes
      containerSet = {
        containers = [
          {
            name = "scale-buildkit"
            command = ["/bin/pf-buildkit-scale-up", "--wait", "--only=amd64"]
          },
          {
            name = "clone"
            command = ["/scripts/clone.sh"]
          },
          {
            name = "build"
            command = ["/scripts/build.sh"]
            dependencies = ["scale-buildkit", "clone"]
          }
        ]
      }
    },

    {
      name = "main-dag"
      dag = {
        tasks = [
          {
            name = "build-images"
            template = "build-images"
          },

          {
            name = "scrape-and-index"
            templateRef = {
              name = module.run_scraper_workflow_spec.name
              template = "entry"
            }
            depends = "build-images"
          }
        ]
      }
    }
  ]
  tmp_directories = {
    "cache" = {
      mount_path = "/tmp"
      size_mb = 100
    }

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
    "${kubernetes_config_map.astro_builder_scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }
}

resource "kubectl_manifest" "astro_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind = "WorkflowTemplate"
    metadata = {
      name = local.website_astro_builder_name
      namespace = local.namespace
      labels = module.astro_builder_workflow.labels
    }
    spec = module.astro_builder_workflow.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}

