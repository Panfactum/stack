module "run_scraper_workflow_spec" {
  source                    = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=e7bce6f03ec62851b2ca375337dd01253a84482d" #pf-update

  name = "run-scraper-and-index"
  namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  active_deadline_seconds = 60 * 60

  common_env = {
    ALGOLIA_APP_ID = var.algolia_app_id
    ALGOLIA_INDEX_NAME = var.algolia_index_name
    TMP_DIR = "/tmp"
  }

  tmp_directories = {
    "cache" = {
      mount_path = "/tmp"
      size_mb = 100
    }
  }

  common_secrets = {
    ALGOLIA_API_KEY = var.algolia_api_key
  }

  arguments = {
    parameters = [
      {
        name = "sitemap_url"
        description = "The URL of the sitemap to scrape"
        default = "https://panfactum.com/sitemap.xml"
      }
    ]
  }

  default_resources = {
    requests = {
      cpu    = "50m"
      memory = "250Mi"
    }
    limits = {
      memory = "500Mi"
    }
  }

  read_only = false

  entrypoint = "entry"
  templates = [
    {
      name = "scrape-and-index",
      container = {
        image = "891377197483.dkr.ecr.us-east-2.amazonaws.com/scraper:${var.scraper_image_version}"
        command = ["node"]
        args = ["index.js", "{{workflow.parameters.sitemap_url}}"]
      }
    },
    {
      name = "entry",
      dag = {
        tasks = [
          {
            name = "scrape-and-index"
            template: "scrape-and-index"
          }
        ]
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

resource "kubectl_manifest" "build_and_deploy_scraper_workflow_template" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind = "WorkflowTemplate"
    metadata = {
      name = module.run_scraper_workflow_spec.name
      namespace = local.namespace
      labels = module.run_scraper_workflow_spec.labels
    }
    spec = module.run_scraper_workflow_spec.workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}
