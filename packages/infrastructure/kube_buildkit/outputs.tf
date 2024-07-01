output "cache_bucket_name" {
  value = module.cache_bucket.bucket_name
}

output "cache_bucket_region" {
  value = data.aws_region.region.name
}

output "ecr_registry" {
  value = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.region.name}.amazonaws.com"
}

output "eks_cluster_name" {
  value = var.eks_cluster_name
}
