include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "account" {
  config_path = "../../global/aws_account"
}

dependency "monitoring" {
  config_path  = "../kube_monitoring"
  skip_outputs = true
}

inputs = {
  spot_data_feed_bucket        = dependency.account.outputs.spot_data_feed_bucket
  spot_data_feed_bucket_arn    = dependency.account.outputs.spot_data_feed_bucket_arn
  spot_data_feed_bucket_region = dependency.account.outputs.spot_data_feed_bucket_region
}
