module "run_scraper_workflow_spec" {
  source                    = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name = "run-scraper-and-index"
  namespace = local.namespace
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
      },

      {
        name = "algolia_index_name"
        description = "The index name in algolia to update"
      }
    ]
  }

  default_resources = {
    requests = {
      cpu    = "100m"
      memory = "512Mi"
    }
    limits = {
      memory = "1024Mi"
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
        args = ["index.js", "{{workflow.parameters.sitemap_url}}", "{{workflow.parameters.algolia_index_name}}"]
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
