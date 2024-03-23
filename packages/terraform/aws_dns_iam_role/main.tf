// Module

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

module "tags" {
  source         = "../aws_tags"
  environment    = var.environment
  region         = var.region
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  extra_tags     = var.extra_tags
  is_local       = var.is_local
}

/********************************************************************************************************************
* Permissions
*********************************************************************************************************************/
data "aws_caller_identity" "main" {}

data "aws_route53_zone" "zones" {
  for_each = var.domain_names
  name     = each.key
}

data "aws_iam_policy_document" "record_manager" {
  statement {
    effect    = "Allow"
    actions   = ["route53:ListHostedZonesByName", "route53:ListHostedZones"]
    resources = ["*"]
  }

  statement {
    effect  = "Allow"
    actions = ["route53:GetChange"]
    resources = [
      "arn:aws:route53:::change/*"
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "route53:ChangeResourceRecordSets",
      "route53:ListResourceRecordSets"
    ]
    resources = [for domain in var.domain_names : "arn:aws:route53:::hostedzone/${data.aws_route53_zone.zones[domain].zone_id}"]
  }
}

data "aws_iam_policy_document" "record_manager_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      identifiers = concat([data.aws_caller_identity.main.account_id], var.additional_account_ids_with_record_access)
      type        = "AWS"
    }
  }
}

resource "aws_iam_policy" "record_manager" {
  name_prefix = "route53-record-manager-"
  policy      = data.aws_iam_policy_document.record_manager.json
  tags = merge(module.tags.tags, {
    description = "Policy that grants permissions to update records in the DNS zones of this account"
  })
}

resource "aws_iam_role" "record_manager" {
  name_prefix        = "route53-record-manager-"
  assume_role_policy = data.aws_iam_policy_document.record_manager_assume_role.json
  tags = merge(module.tags.tags, {
    description = "Role that grants permissions to update records in the DNS zones of this account"
  })
}

resource "aws_iam_role_policy_attachment" "record_manager" {
  policy_arn = aws_iam_policy.record_manager.arn
  role       = aws_iam_role.record_manager.name
}