# Terraform / OpenTofu Bootstrap Resources

**Type:** Live

Sets up the AWS resources necessary to begin using OpenTofu (Terraform) in an AWS account:

- S3 state bucket

- DynamoDB lock table

Provides the following features over the default Terragrunt bootstrapped resources:

- Multi-region replication for dynamodb tables

- Lifecycle transitions for S3 objects to cheaper storage tiers

- Point-in-time backups retained for 24 hours via [AWS Backup](https://aws.amazon.com/backup/)