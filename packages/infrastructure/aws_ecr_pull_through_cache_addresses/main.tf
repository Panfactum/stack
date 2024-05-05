// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
