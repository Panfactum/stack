terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

locals {
  allowed_services = [
    "account",
    "application-cost-profiler",
    "application-autoscaling",
    "discovery",
    "iam",
    "s3",
    "s3-object-lambda",
    "s3express",
    "backup",
    "glacier",
    "route53",
    "route53resolver",
    "route53-recovery-readiness",
    "route53-recovery-control-config",
    "route53-recovery-cluster",
    "route53domains",
    "arc-zonal-shift",
    "resource-explorer-2",
    "pricing",
    "networkmanager",
    "network-firewall",
    "cloudtrail",
    "cloudwatch",
    "cloudfront",
    "acm",
    "lambda",
    "waf-regional",
    "kinesis",
    "firehose",
    "kinesisanalytics",
    "guardduty",
    "globalaccelerator",
    "fis",
    "emr-containers",
    "ecs",
    "events",
    "scheduler",
    "schemas",
    "pipes",
    "mediaconvert",
    "elasticfilesystem",
    "waf",
    "wafv2",
    "ec2",
    "ebs",
    "ecr",
    "ecr-public",
    "drs",
    "cur",
    "ce",
    "cognito-identity",
    "cognito-sync",
    "cognito-idp",
    "cost-optimization-hub",
    "controltower",
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
    "states",
    "secretsmanager"
  ]
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
      "iam:UpdateAssumeRolePolicy",
      "iam:UpdateRole",
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

      // Prevent messing with identity center
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
    resources = ["*"]
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

  // TODO: Protect DNS

  // TODO: Protect EBS snapshots

  // TODO: Protect S3 object versions

  // TODO: Protect KMS keys

}


######################### Reader #######################################

data "aws_iam_policy_document" "reader_policy" {
  statement {
    effect = "Allow"
    actions = concat(
      # Assign read-only permissions to core service classes
      flatten([for class in local.allowed_services : ["${class}:Get*", "${class}:List*", "${class}:Describe*"]]),

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
        "kms:Encrypt",
        "kms:Generate*",
        "eks:AccessKubernetesApi"
      ]
    )
    resources = ["*"]
  }
}

######################### Restricted Reader #######################################

data "aws_iam_policy_document" "restricted_reader_policy" {
  statement {
    effect = "Allow"
    actions = concat(
      # Assign read-only permissions to core service classes
      flatten([for class in local.allowed_services : ["${class}:Get*", "${class}:List*", "${class}:Describe*"]]),

      # Extra permissions
      [
        "iam:Generate*",
        "cloudtrail:StartQuery",
        "cloudtrail:LookupEvents",
        "sts:GetCallerIdentity",
        "sns:Check*",
        "kms:Encrypt",
        "kms:Generate*",
        "eks:AccessKubernetesApi",
        "aws-portal:ViewAccount",
        "aws-portal:ViewBilling",
        "aws-portal:ViewUsage"
      ]
    )
    resources = ["*"]
  }

  # These actions can potentially expose sensitive data
  statement {
    effect = "Deny"
    actions = [
      "s3:getObject",
      "secretsmanager:GetSecretValue",
      "ec2:GetPasswordData",
      "rds:DescribeDBSnapshots"
    ]
    resources = ["*"]
  }
}
