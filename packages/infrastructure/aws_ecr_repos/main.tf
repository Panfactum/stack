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

  # pf-generate: set_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

##########################################################################
## Repo setup
##########################################################################

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "access" {
  for_each = var.ecr_repositories
  statement {
    effect = "Allow"
    principals {
      identifiers = [
        for id in tolist(toset(concat(each.value.additional_push_account_ids, [data.aws_caller_identity.current.account_id]))) : "arn:aws:iam::${id}:root"
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
  statement {
    effect = "Allow"
    principals {
      identifiers = [
        for id in tolist(toset(concat(each.value.additional_pull_account_ids, [data.aws_caller_identity.current.account_id]))) : "arn:aws:iam::${id}:root"
      ]
      type = "AWS"
    }
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
      "ecr:GetLifecyclePolicy",
      "ecr:GetLifecyclePolicyPreview",
      "ecr:GetRepositoryPolicy",
      "ecr:ListImages",
    ]
  }
}

resource "aws_ecr_repository" "repo" {
  for_each             = var.ecr_repositories
  name                 = each.key
  image_tag_mutability = each.value.is_immutable ? "IMMUTABLE" : "MUTABLE"
  tags                 = module.tags.tags
}

resource "aws_ecr_repository_policy" "delegated_access" {
  for_each   = var.ecr_repositories
  policy     = data.aws_iam_policy_document.access[each.key].json
  repository = aws_ecr_repository.repo[each.key].name
}

resource "aws_ecr_lifecycle_policy" "lifecycle" {
  for_each = var.ecr_repositories
  policy = jsonencode({
    rules = concat(
      [
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
        ], each.value.expire_all_images ? [
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
          rulePriority = 100
        }
      ] : [],
      [for rule_index in range(length(each.value.expiration_rules)) : {
        action = {
          type = "expire"
        }
        selection = {
          tagStatus      = "tagged",
          countType      = "sinceImagePushed",
          countUnit      = "days",
          countNumber    = each.value.expiration_rules[rule_index].days,
          tagPatternList = [each.value.expiration_rules[rule_index].tag_pattern]
        },
        description  = "Remove old by pattern"
        rulePriority = rule_index + 2
      }]
    )
  })
  repository = aws_ecr_repository.repo[each.key].name
}
