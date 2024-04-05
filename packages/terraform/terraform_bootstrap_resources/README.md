# Terraform Bootstrap Resources

**Type:** Live

Sets up the AWS resources necessary to begin terraforming in an environment:

- s3 state bucket
- dynamodb lock table

Provides the following features over the default terragrunt bootstrapped resources:

- Multi-region replication for dynamodb tables
- Lifecycle transitions for S3 objects to cheaper storage tiers
- Point-in-time backups retained for 24 hours via [AWS Backup](https://aws.amazon.com/backup/)