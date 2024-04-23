// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

module "tags" {
  source = "../aws_tags"

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  extra_tags       = var.extra_tags
  is_local         = var.is_local
}

##########################################################################
## Repo setup
##########################################################################

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "trust_accounts" {
  statement {
    effect = "Allow"
    principals {
      identifiers = [
        for id in tolist(toset(concat(var.trusted_account_ids, [data.aws_caller_identity.current.account_id]))) : "arn:aws:iam::${id}:root"
      ]
      type = "AWS"
    }
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchDeleteImage",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DeleteLifecyclePolicy",
      "ecr:DeleteRepository",
      "ecr:DeleteRepositoryPolicy",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
      "ecr:GetLifecyclePolicy",
      "ecr:GetLifecyclePolicyPreview",
      "ecr:GetRepositoryPolicy",
      "ecr:InitiateLayerUpload",
      "ecr:ListImages",
      "ecr:PutImage",
      "ecr:PutLifecyclePolicy",
      "ecr:SetRepositoryPolicy",
      "ecr:StartLifecyclePolicyPreview",
      "ecr:UploadLayerPart"
    ]
  }
}

resource "aws_ecr_repository" "repo" {
  for_each             = toset(var.ecr_repository_names)
  name                 = each.key
  image_tag_mutability = var.is_immutable ? "IMMUTABLE" : "MUTABLE"
  tags                 = module.tags.tags
}

resource "aws_ecr_repository_policy" "delegated_access" {
  for_each   = toset(var.ecr_repository_names)
  policy     = data.aws_iam_policy_document.trust_accounts.json
  repository = aws_ecr_repository.repo[each.key].name
}

resource "aws_ecr_lifecycle_policy" "lifecycle" {
  for_each = toset(var.ecr_repository_names)
  policy = jsonencode({
    rules = concat([
      {
        action = {
          type = "expire"
        }
        selection = {
          countType   = "imageCountMoreThan"
          countNumber = 3
          tagStatus   = "untagged"
        }
        description  = "Keep last 3 untagged images"
        rulePriority = 1
      }
      ], var.expire_tagged_images ? [
      {
        action = {
          type = "expire"
        }
        selection = {
          tagStatus   = "any",
          countType   = "sinceImagePushed",
          countUnit   = "days",
          countNumber = 14
        },
        description  = "Remove old images"
        rulePriority = 2
      }
    ] : [])
  })
  repository = aws_ecr_repository.repo[each.key].name
}
