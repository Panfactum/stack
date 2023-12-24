terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.10"
    }
  }
}

data "aws_caller_identity" "main" {}


resource "aws_s3_bucket" "bucket" {
  bucket              = var.bucket_name
  object_lock_enabled = false
  tags = {
    description = var.description
  }
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket_server_side_encryption_configuration" "bucket" {
  bucket = aws_s3_bucket.bucket.bucket
  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
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
    object_ownership = "BucketOwnerEnforced"
  }
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

  rule {
    id     = "timed-transitions"
    status = var.timed_transitions_enabled ? "Enabled" : "Disabled"
    filter {}
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
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
}

data "aws_iam_policy_document" "policy" {

  // Concatenates the inline access policy provided to the module
  override_policy_documents = var.access_policy == "" ? [] : [var.access_policy]
}

resource "aws_s3_bucket_policy" "bucket" {
  count  = var.access_policy == "" ? 0 : 1
  bucket = aws_s3_bucket.bucket.bucket
  policy = data.aws_iam_policy_document.policy.json
}

/***************************************************************
* Bucket Audit Logging
***************************************************************/
resource "aws_s3_bucket" "audit" {
  count               = var.audit_log_enabled ? 1 : 0
  bucket              = "${var.bucket_name}-audit-log"
  object_lock_enabled = true

  tags = {
    description = "Audit logs for the ${var.bucket_name} bucket"
  }
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
