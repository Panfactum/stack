# AWS CDN for Kubernetes Ingresses

import MarkdownAlert from "@/components/markdown/MarkdownAlert";

This module creates a CDN for a set of Kubernetes Ingresses by aggregating the `cdn_origin_configs`
output from instances of the [kube_ingress](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_ingress)
module and forwarding them to the [aws_cdn](/docs/main/reference/infrastructure-modules/submodule/aws/aws_cdn) module.

This module takes the same arguments as `aws_cdn`, so see it's [module documentation](/docs/main/reference/infrastructure-modules/submodule/aws/aws_cdn)
for more information.

## Limitations

* The upstream ingresses for this module must all use the same set of domains. AWS Cloudfront provides
   no ability to perform routing based on domain names (only HTTP paths). If the ingresses
   you provide this module use different sets of domains, your routing will break in unexpected ways.

* Changing the domains of your upstream ingresses will cause the Cloudfront distribution to re-provision its certificates
   causing a brief window of downtime (1-2 minutes).

* You cannot use the same domain name on multiple CDNs. As a result, you can only create ONE `kube_aws_cdn` resource
   for all ingresses that use a particular domain name.

* For additional limitations, see the [aws_cdn](/docs/main/reference/infrastructure-modules/submodule/aws/aws_cdn) module docs.

## Usage

<MarkdownAlert severity="warning">
   Note that the `aws.global` provider must be set exactly as shown in the below example as the CloudFront resources
   are deployed globally.
</MarkdownAlert>

```hcl
terraform {
   required_providers {
      ...
      aws = {
         source                = "hashicorp/aws"
         version               = "5.70.0"
         configuration_aliases = [aws.global]
      }
      ...
   }
}

module "ingress_1" {
   source = "${var.pf_module_source}kube_ingress${var.pf_module_ref}"

   namespace    = local.namespace
   name         = "example1"
   domains      = ["example.com"]
   
    ...
   
   # CDN mode MUST be enabled if you want to use a
   # CDN in front of an ingress
   cdn_mode_enabled = true 
}

module "ingress_2" {
   source = "../kube_ingress"

   namespace    = local.namespace
   name         = "example2"
   domains      = ["example.com"]

   ...
   
   cdn_mode_enabled = true
   ingress_configs  = [{
      path_prefix = "/test"
      
      ...
      
      # You can configure CDN behavior on a per-ingress basis
      # See the kube_ingress documentation for more information
      cdn = {
         default_cache_behavior = {
            headers_in_cache_key = ["Authorization"]
         }
      }
   }]


}

module "cdn" {
   source = "${var.pf_module_source}kube_aws_cdn${var.pf_module_ref}"
   
   # Since the CDN operates globally, you must use the global
   # provider as follows:
   providers = {
     aws.global = aws.global
   }

   name               = "example"
   
   # Concatenate the CDN configs provided by each
   # ingress module and pass them to the CDN module
   origin_configs = concat(
     module.ingress_1.cdn_origin_configs,
     module.ingress_2.cdn_origin_configs
   )
}
```






