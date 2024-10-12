# AWS CDN

Deploys an [AWS CloudFront distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)
([CDN](https://en.wikipedia.org/wiki/Content_delivery_network)) that can be used to proxy requests to your upstream origins.

This module performs several functions in addition to providing sensible defaults for the CDN:

- Sets up the CDN TLS certificates
- Sets up the DNS records for the CDN
- Provides pre-packaged edge function behaviors (e.g., URL rewrite rules)
- Allows for request logging

## Limitations

1. The domain names used for the CDN must be served by Route53 zones in the AWS account within which this module
   is deployed. This is because this module automatically configures all the necessary DNS settings.


## Usage
