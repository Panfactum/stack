terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

data "aws_region" "current" {}

/***************************************
* S3 Destination Bucket
***************************************/

resource "random_id" "bucket_name" {
  byte_length = 8
  prefix      = var.bucket_prefix
}

module "s3_bucket" {
  source = "${var.pf_module_source}aws_s3_private_bucket${var.pf_module_ref}"
  bucket_name = var.bucket_name != null ? var.bucket_name : random_id.bucket_name.hex
  description = "Airbyte S3 destination for data sync"

  versioning_enabled             = var.versioning_enabled
}
