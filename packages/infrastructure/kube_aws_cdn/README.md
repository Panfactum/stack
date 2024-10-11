# Kubernetes CDN


## Usage



### Limitations

1. The upstream ingresses for this module must all use the same set of domains. AWS Cloudfront provides
no ability to perform routing based on domain names (only HTTP paths), so you cannot have more than
one upstream ingress listening on any given path (even if they are on different domains). If the ingresses
you provide this module use different sets of domains, your routing will break in unexpected ways.

2. Changing the domains of your upstream ingresses will cause the Cloudfront distribution to re-provision its certificates
causing a brief window of downtime (1-2 minutes).



