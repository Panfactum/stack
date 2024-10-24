# Public Files Hosted in S3 Bucket

This module creates an S3 bucket fronted by CloudFront. Files in this bucket will be available at a
public URL. The URL for each file is `https://{var.domain}/path/to/file/in/bucket`.

Under the hood, this module passes most arguments to either

- `aws_cdn` ([docs](/docs/main/reference/infrastructure-modules/submodule/aws/aws_cdn)); or
- `aws_s3_private_bucket` ([docs](/docs/main/reference/infrastructure-modules/submodule/aws/aws_s3_private_bucket))

so see the documentation for those modules for more information about various input settings.




