output "ecr_public_registry" {
  value = var.pull_through_cache_enabled ? "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/ecr-public" : "public.ecr.aws"
}

output "kubernetes_registry" {
  value = var.pull_through_cache_enabled ? "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/kubernetes" : "registry.k8s.io"
}

output "quay_registry" {
  value = var.pull_through_cache_enabled ? "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/quay" : "quay.io"
}

output "docker_hub_registry" {
  value = var.pull_through_cache_enabled ? "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/docker-hub" : "docker.io"
}

output "github_registry" {
  value = var.pull_through_cache_enabled ? "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/github" : "ghcr.io"
}

