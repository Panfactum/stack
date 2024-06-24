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

resource "aws_ecrpublic_repository" "repo" {
  provider        = aws.global
  for_each        = var.ecr_repositories
  repository_name = each.key
  catalog_data {
    about_text        = each.value.about_text
    architectures     = each.value.architectures
    description       = each.value.description
    logo_image_blob   = each.value.logo_image_blob
    operating_systems = each.value.operating_systems
    usage_text        = each.value.usage_text
  }
  tags = module.tags.tags
}

resource "aws_ecrpublic_repository_policy" "delegated_access" {
  provider        = aws.global
  for_each        = var.ecr_repositories
  policy          = data.aws_iam_policy_document.trust_accounts.json
  repository_name = aws_ecrpublic_repository.repo[each.key].repository_name
}
