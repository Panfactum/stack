module "scraper_builder" {
  source                    = "${var.pf_module_source}wf_dockerfile_build${var.pf_module_ref}"

  name = "scraper-builder"
  namespace = local.namespace
  pull_through_cache_enabled = var.pull_through_cache_enabled

  code_repo = "github.com/panfactum/stack.git"
  dockerfile_path = "./packages/scraper/Containerfile"
  image_repo = "scraper"
}
