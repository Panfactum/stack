# AWS ECR Repositories

This module deploys image repositories in the AWS account's ECR. This allows you to push and pull images
directly to AWS.

## Pulling and Pushing Images Locally

We cover this in the [BuildKit guide](/docs/main/guides/addons/buildkit/installing).

## Pulling and Pushing Images Across Accounts

Images can be pulled or pushed by IAM users / roles set up in other AWS accounts by specifying `<repo>.additional_pull_account_ids`
and `<repo>.additional_push_account_ids` respectively.

This will allow you to have a central image repository that can be used by multiple AWS accounts and allow for promoting 
image artifacts across environments rather than rebuilding for each environment.

IAM users and roles in other accounts must still have the 
[appropriate permissions to interact with ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policy-examples.html). 
We provide this automatically for Kubernetes clusters deployed with the [aws_eks](/docs/main/reference/infrastructure-modules/direct/aws/aws_eks)
module.

## Image Immutability

By default, immutability is turned on for each repository (`<repo>.is_immutable`). This means that once
an image with a specific tag is pushed, that tag may never be overridden with a new image. 

This is a security measure to ensure that once an image is deployed in an environment it's contents can
never be changed. Only disable immutability if you will never use the image in a sensitive environment.

## Garbage Collecting Images

You might want to periodically remove outdated or unused images to save on storage costs. We provide
three means to do so:

1. We automatically remove untagged images as if an image loses its tag, it is assumed it will never be pulled again.

1. If set to `true`, `<repo>.expire_all_images` will automatically remove an image 14 days after it was created. This
can be helpful for images generated during local development that will not be used in production and can be easily
regenerated.

1. We provide a `<repo>.expiration_rules` field that will allow you to specify custom 
[lifecycle policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/lpp_creation.html) for
each repository based on the image's tag pattern. See the linked docs for available patterns.

