terraform {
  required_providers {
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

data "pf_aws_tags" "tags" {
  module = "aws_ecr_pull_through_cache"
}


##########################################################################
## Rule Setup
##########################################################################

resource "aws_ecr_pull_through_cache_rule" "quay" {
  ecr_repository_prefix = "quay"
  upstream_registry_url = "quay.io"
}

resource "aws_ecr_pull_through_cache_rule" "kubernetes" {
  ecr_repository_prefix = "kubernetes"
  upstream_registry_url = "registry.k8s.io"
}


resource "aws_ecr_pull_through_cache_rule" "ecr_public" {
  ecr_repository_prefix = "ecr-public"
  upstream_registry_url = "public.ecr.aws"
}

resource "aws_secretsmanager_secret" "docker" {
  name_prefix = "ecr-pullthroughcache/docker-hub-"
  description = "Used for authenticating with Docker Hub by the ECR pull through cache"
  tags        = data.pf_aws_tags.tags.tags
}

resource "aws_secretsmanager_secret_version" "docker" {
  secret_id = aws_secretsmanager_secret.docker.id
  secret_string = jsonencode({
    username    = var.docker_hub_username
    accessToken = var.docker_hub_access_token
  })
}

resource "aws_ecr_pull_through_cache_rule" "docker" {
  ecr_repository_prefix = "docker-hub"
  upstream_registry_url = "registry-1.docker.io"
  credential_arn        = aws_secretsmanager_secret.docker.arn
  depends_on            = [aws_secretsmanager_secret_version.docker]
}

resource "aws_secretsmanager_secret" "github" {
  name_prefix = "ecr-pullthroughcache/github-"
  description = "Used for authenticating with GitHub by the ECR pull through cache"
  tags        = data.pf_aws_tags.tags.tags
}

resource "aws_secretsmanager_secret_version" "github" {
  secret_id = aws_secretsmanager_secret.github.id
  secret_string = jsonencode({
    username    = var.github_username
    accessToken = var.github_access_token
  })
}

resource "aws_ecr_pull_through_cache_rule" "github" {
  ecr_repository_prefix = "github"
  upstream_registry_url = "ghcr.io"
  credential_arn        = aws_secretsmanager_secret.github.arn
  depends_on            = [aws_secretsmanager_secret_version.github]
}
