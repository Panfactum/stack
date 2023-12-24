terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.10"
    }
  }
}

locals {
  s3_buckets_and_objects = flatten([for arn in var.protected_s3_arns : [arn, "${arn}/*"]]) # for objects too
  all_protected = concat(
    local.s3_buckets_and_objects,
    var.protected_kms_arns,
    var.protected_dynamodb_arns
  )
}

######################### Admin #######################################

data "aws_iam_policy_document" "admin_policy" {
  statement {
    effect = "Allow"
    not_actions = [

      // prevent adding persistent security holes
      // or privilege escalation
      "iam:CreatePolicy",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicy",
      "iam:DeletePolicyVersion",
      "iam:AddUserToGroup",
      "iam:AttachUserPolicy",
      "iam:CreateUser",
      "iam:DeleteUser",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:DeleteRolePermissionsBoundary",
      "iam:DeleteRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:PutRolePermissionsBoundary",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:UpdateRole",
      "iam:UpdateRoleDescription",
      "iam:DetachUserPolicy",
      "iam:DeleteUserPolicy",
      "iam:PutUserPolicy",
      "iam:RemoveUserFromGroup",
      "iam:UpdateUser",
      "iam:AttachGroupPolicy",
      "iam:CreateGroup",
      "iam:DeleteGroup",
      "iam:DeleteGroupPolicy",
      "iam:DetachGroupPolicy",
      "iam:PutGroupPolicy",
      "iam:UpdateGroup",
      "iam:CreateSAMLProvider",
      "iam:CreateOpenIDConnectProvider",
      "iam:DeleteSAMLProvider",
      "iam:DeleteOpenIDConnectProvider",
      "iam:UpdateSAMLProvider",
      "iam:UpdateOpenIDConnectProvider",
      "iam:CreateAccessKey",
      "iam:UpdateAccessKey",
      "iam:DeleteAccessKey",
      "sso:*",
      "sso-directory:*",

      // Prevent messing with governance
      "organizations:*",
      "account:*",
      "iam:DeleteAccountAlias",
      "iam:CreateAccountAlias",
      "controltower:*",
      "config:*",

      // Prevent messing with billing
      "aws-portal:*",
      "budgets:Modify*",
      "savingsplans:Create*",
      "aws-marketplace:*",
      "aws-marketplace-management:*",

      // Prevent disabling logging
      "cloudtrail:Delete*",
      "cloudtrail:Stop*"
    ]

    // for now, prevent any operations on protected resources
    not_resources = local.all_protected
  }

  // gives some access to non-secret metadata
  statement {
    effect = "Allow"
    actions = [
      "account:ListRegions",
      "aws-portal:ViewAccount",
      "aws-portal:ViewBilling",
      "aws-portal:ViewUsage"
    ]
    resources = ["*"]
  }

  # For admins, protected buckets:
  #  - CAN have their objects read, updated, and deleted
  #  - CAN have their properties listed and read
  statement {
    effect = "Allow"
    actions = [
      "s3:Get*",
      "s3:List*",
      "s3:Describe*",
      "s3:PutObject",
      "s3:RestoreObject",
      "s3:AbortMultipartUpload",
      "s3:DeleteObject" # Simply adds a delete marker if versioning is enabled
    ]
    resources = length(local.s3_buckets_and_objects) == 0 ? ["*"] : local.s3_buckets_and_objects
  }

  # For admins, protected kms keys:
  # - CAN have their properties listed and read
  # - CAN be used for cryptographic operations
  statement {
    effect = "Allow"
    actions = [
      "kms:Get*",
      "kms:List*",
      "kms:Describe*",
      "kms:Decrypt",
      "kms:Encrypt",
      "kms:Generate*"
    ]
    resources = length(var.protected_kms_arns) == 0 ? ["*"] : var.protected_kms_arns
  }

  # For admins, protected dynamodb tables:
  # - CAN have their properties listed and read
  # - CAN have their items updated and queried
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:Get*",
      "dynamodb:List*",
      "dynamodb:Describe*",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem"
    ]
    resources = length(var.protected_dynamodb_arns) == 0 ? ["*"] : var.protected_dynamodb_arns
  }

  // TODO: Protect DNS

}

######################### Reader #######################################

data "aws_iam_policy_document" "reader_policy" {
  statement {
    effect = "Allow"
    actions = concat(
      # Assign read-only permissions to core service classes
      flatten([for class in [
        "iam",
        "s3",
        "glacier",
        "route53",
        "cloudtrail",
        "cloudwatch",
        "cloudfront",
        "acm",
        "lambda",
        "waf-regional",
        "waf",
        "wafv2",
        "ec2",
        "ebs",
        "ecr",
        "eks",
        "tag",
        "sns",
        "sqs",
        "ssm",
        "kms",
        "elasticloadbalancing",
        "rds",
        "autoscaling-plans",
        "elasticache",
        "dynamodb",
        "identitystore",
        "sso",
        "logs",
        "autoscaling",
        "states"
      ] : ["${class}:Get*", "${class}:List*", "${class}:Describe*"]]),

      # Extra permissions
      [
        "iam:Generate*",
        "aws-portal:ViewAccount",
        "aws-portal:ViewBilling",
        "aws-portal:ViewUsage",
        "cloudtrail:StartQuery",
        "cloudtrail:LookupEvents",
        "sts:GetCallerIdentity",
        "tag:DescribeReportCreation",
        "sns:Check*",
        "dynamodb:Query",
        "dynamodb:Scan",
        "kms:Encrypt",
        "kms:Generate*",
        "eks:AccessKubernetesApi"
      ]
    )

    # Deny all access to the protected resources
    not_resources = local.all_protected
  }

  # Give the ability to start an remote port forward (but don't allow arbitrary execution on the nodes)
  statement {
    effect = "Allow"
    actions = [
      "ssm:StartSession"
    ]
    condition {
      test     = "BoolIfExists"
      values   = ["true"]
      variable = "ssm:SessionDocumentAccessCheck"
    }
    resources = [
      "arn:aws:ec2:*:*:instance/*",
      "arn:aws:ssm:*:*:document/AWS-StartPortForwardingSessionToRemoteHost"
    ]
  }
  statement {
    effect = "Allow"
    actions = [
      "ssm:TerminateSession",
      "ssm:ResumeSession"
    ]
    resources = ["arn:aws:ssm:*:*:session/$${aws:username}-*"]
  }
}

######################### CI Reader #######################################

data "aws_iam_policy_document" "ci_reader_policy" {
  # For ci bots, protected buckets:
  #  - CAN have their objects and configurations read
  statement {
    effect = "Allow"
    actions = [
      "s3:Get*",
      "s3:List*",
      "s3:Describe*"
    ]
    resources = length(local.s3_buckets_and_objects) == 0 ? ["*"] : local.s3_buckets_and_objects
  }

  # For ci bots, protected kms keys:
  # - CAN have their properties listed and read
  statement {
    effect = "Allow"
    actions = [
      "kms:Get*",
      "kms:List*",
      "kms:Describe*",
      "kms:Decrypt"
    ]
    resources = length(var.protected_kms_arns) == 0 ? ["*"] : var.protected_kms_arns
  }

  # For CI bots, protected dynamodb tables:
  # - CAN have their properties listed and read
  # - CAN have their items updated and queried
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:Get*",
      "dynamodb:List*",
      "dynamodb:Describe*",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem"
    ]
    resources = length(var.protected_dynamodb_arns) == 0 ? ["*"] : var.protected_dynamodb_arns
  }
}
