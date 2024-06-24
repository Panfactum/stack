# Public AWS ECR Repositories

## Differences from Private ECR Repositories

- All public ECR repositories are created in `us-east-1`.

- Once published, image tags are immutable.

- There is no automatic lifecycle management for images published to public repositories.

## Custom Registry Alias

Once you deploy public ECR repos, you should request a 
[custom alias](https://docs.aws.amazon.com/AmazonECR/latest/public/public-registry-settings.html). 
This may take a few days to be approved.

## Deployment Notes

- This module should be deployed in the `global` region.


