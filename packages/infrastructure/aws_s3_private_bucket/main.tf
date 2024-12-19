terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

data "aws_caller_identity" "main" {}
data "aws_canonical_user_id" "main" {}

data "pf_aws_tags" "tags" {
  module = "aws_s3_private_bucket"
}


resource "aws_s3_bucket" "bucket" {
  bucket              = var.bucket_name
  object_lock_enabled = false
  tags = merge(data.pf_aws_tags.tags.tags, {
    description = var.description
  })
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket_server_side_encryption_configuration" "bucket" {
  bucket = aws_s3_bucket.bucket.bucket
  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_master_key_id == null ? "AES256" : "aws:kms"
      kms_master_key_id = var.kms_master_key_id
    }
  }
}

resource "aws_s3_bucket_public_access_block" "bucket" {
  bucket                  = aws_s3_bucket.bucket.bucket
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "bucket" {
  bucket = aws_s3_bucket.bucket.id
  rule {
    object_ownership = var.acl_enabled || var.acl_aws_logs_delivery_enabled ? "BucketOwnerPreferred" : "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_acl" "aws_logs_delivery" {
  count = var.acl_aws_logs_delivery_enabled ? 1 : 0

  bucket                = aws_s3_bucket.bucket.bucket
  expected_bucket_owner = data.aws_caller_identity.main.account_id
  access_control_policy {
    grant {
      permission = "FULL_CONTROL"
      grantee {
        type = "CanonicalUser"
        id   = "c4c1ede66af53448b93c283ce9448c4ba468c9432aa01d700d3878632f77d2d0" # Canonical ID of the AWS logs Delivery Account
      }
    }
    owner {
      id = data.aws_canonical_user_id.main.id
    }
  }
  depends_on = [aws_s3_bucket_ownership_controls.bucket]
}

resource "aws_s3_bucket_versioning" "bucket" {
  bucket = aws_s3_bucket.bucket.bucket
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}


resource "aws_s3_bucket_lifecycle_configuration" "bucket" {
  # Must have bucket versioning enabled first
  depends_on = [aws_s3_bucket_versioning.bucket]

  bucket = aws_s3_bucket.bucket.bucket

  rule {
    id     = "abort-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  rule {
    id     = "expire-old-versions"
    status = var.versioning_enabled && var.expire_old_versions ? "Enabled" : "Disabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    noncurrent_version_transition {
      noncurrent_days = 60
      storage_class   = "DEEP_ARCHIVE"
    }
  }

  rule {
    id     = "expire-old"
    status = var.expire_after_days > 0 ? "Enabled" : "Disabled"
    filter {}
    expiration {
      days = var.expire_after_days
    }
  }

  // This is the most aggressive cost-savings transitions allowed
  // by AWS
  rule {
    id     = "timed-transitions"
    status = var.timed_transitions_enabled ? "Enabled" : "Disabled"
    filter {}
    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }
    transition {
      days          = 60
      storage_class = "DEEP_ARCHIVE"
    }
  }
}

resource "aws_s3_bucket_intelligent_tiering_configuration" "bucket" {
  bucket = aws_s3_bucket.bucket.bucket
  name   = aws_s3_bucket.bucket.bucket
  status = var.intelligent_transitions_enabled ? "Enabled" : "Disabled"

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  lifecycle {
    precondition {
      condition     = (var.timed_transitions_enabled && !var.intelligent_transitions_enabled) || (!var.timed_transitions_enabled && var.intelligent_transitions_enabled) || (!var.timed_transitions_enabled && !var.intelligent_transitions_enabled)
      error_message = "Intelligent transitions cannot be enabled simultaneously with timed transitions"
    }
  }
}



data "aws_iam_policy_document" "default_policy" {
  override_policy_documents = var.access_policy == null ? [] : [var.access_policy]
  statement {
    sid     = "RootAccess"
    effect  = "Allow"
    actions = ["s3:*"]
    principals {
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.main.account_id}:root"]
      type        = "AWS"
    }
    resources = [aws_s3_bucket.bucket.arn, "${aws_s3_bucket.bucket.arn}/*"]
  }
}

resource "aws_s3_bucket_policy" "bucket" {
  bucket = aws_s3_bucket.bucket.bucket
  policy = data.aws_iam_policy_document.default_policy.json
}

/***************************************************************
* Bucket Audit Logging
***************************************************************/

// TODO: This appears to be broken
// Need to investigate and fix

resource "aws_s3_bucket" "audit" {
  count               = var.audit_log_enabled ? 1 : 0
  bucket              = "${var.bucket_name}-audit-log"
  object_lock_enabled = true

  tags = merge(data.pf_aws_tags.tags.tags, {
    description = "Audit logs for the ${var.bucket_name} bucket"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit" {
  count  = var.audit_log_enabled ? 1 : 0
  bucket = aws_s3_bucket.audit[0].bucket
  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "audit" {
  count                   = var.audit_log_enabled ? 1 : 0
  bucket                  = aws_s3_bucket.audit[0].bucket
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_object_lock_configuration" "audit" {
  count  = var.audit_log_enabled ? 1 : 0
  bucket = aws_s3_bucket.audit[0].bucket
  rule {
    default_retention {
      mode  = "COMPLIANCE"
      years = 3
    }
  }
}

resource "aws_s3_bucket_intelligent_tiering_configuration" "audit" {
  count  = var.audit_log_enabled ? 1 : 0
  bucket = aws_s3_bucket.audit[0].bucket
  name   = aws_s3_bucket.audit[0].bucket
  status = "Enabled"

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
}

resource "aws_s3_bucket_logging" "audit" {
  count         = var.audit_log_enabled ? 1 : 0
  bucket        = aws_s3_bucket.bucket.bucket
  target_prefix = ""
  target_bucket = aws_s3_bucket.audit[0].id
}
