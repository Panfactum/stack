// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

data "pf_aws_tags" "tags" {
  module = "aws_ecr_public_repos"
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
      "ecr-public:BatchCheckLayerAvailability",
      "ecr-public:BatchDeleteImage",
      "ecr-public:BatchGetImage",
      "ecr-public:CompleteLayerUpload",
      "ecr-public:DeleteLifecyclePolicy",
      "ecr-public:DeleteRepository",
      "ecr-public:DeleteRepositoryPolicy",
      "ecr-public:DescribeImages",
      "ecr-public:DescribeRepositories",
      "ecr-public:GetDownloadUrlForLayer",
      "ecr-public:GetLifecyclePolicy",
      "ecr-public:GetLifecyclePolicyPreview",
      "ecr-public:GetRepositoryPolicy",
      "ecr-public:InitiateLayerUpload",
      "ecr-public:ListImages",
      "ecr-public:PutImage",
      "ecr-public:PutLifecyclePolicy",
      "ecr-public:SetRepositoryPolicy",
      "ecr-public:StartLifecyclePolicyPreview",
      "ecr-public:UploadLayerPart"
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
      "ecr-public:BatchCheckLayerAvailability",
      "ecr-public:BatchGetImage",
      "ecr-public:DescribeImages",
      "ecr-public:DescribeRepositories",
      "ecr-public:GetDownloadUrlForLayer",
      "ecr-public:GetLifecyclePolicy",
      "ecr-public:GetLifecyclePolicyPreview",
      "ecr-public:GetRepositoryPolicy",
      "ecr-public:ListImages",
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
  tags = data.pf_aws_tags.tags.tags
}

resource "aws_ecrpublic_repository_policy" "delegated_access" {
  provider        = aws.global
  for_each        = var.ecr_repositories
  policy          = data.aws_iam_policy_document.access[each.key].json
  repository_name = aws_ecrpublic_repository.repo[each.key].repository_name
}
