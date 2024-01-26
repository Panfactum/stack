# Terraform Bootstrap Resources

Sets up the AWS resources necessary to begin terraforming in an environment:

- s3 state bucket
- dynamodb lock table

## Maintainer Notes

- This module MUST be deployed in the ops environment. It defines its own aws provider for this reason.
As a result, it uses its own aws profile which must be passed in as an input argument.