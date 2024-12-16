# Public Files Hosted in S3 Bucket

This module creates an S3 bucket fronted by CloudFront. Files in this bucket will be available at a
public URL. The URL for each file is `https://{var.domain}/path/to/file/in/bucket`.

Under the hood, this module passes most arguments to either

- `aws_cdn` ([docs](/docs/main/reference/infrastructure-modules/submodule/aws/aws_cdn)); or
- `aws_s3_private_bucket` ([docs](/docs/main/reference/infrastructure-modules/submodule/aws/aws_s3_private_bucket))

so see the documentation for those modules for more information about various input settings.

## Usage

### Re-routing to Default Files

Often you will want to re-route requests from file-less paths
(e.g., `/some/page/`) to paths for a default file in the corresponding folders (e.g., `/some/page/index.html`).

The `default_file` input allows you to specify the filename that requests will be re-routed to (e.g., `/some/page/` -> `/some/page/${var.default_file}`.

By default, `default_file` is `""`, so this re-routing is disabled.

Additionally, the re-routing will _only_ occur if the incoming request's path ends with `/`. To enable more strict
re-routing, set `default_file_strict` to `true` and then all requests with paths that do not contain a `.` will have
the `default_file` appended.


