# AWS CloudFront CDN

import MarkdownAlert from "@/components/markdown/MarkdownAlert";

Deploys an [AWS CloudFront distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)
([CDN](https://en.wikipedia.org/wiki/Content_delivery_network)) that can be used to proxy requests to your upstream origins.

This module performs several functions in addition to providing sensible defaults for the CDN:

- Establishes the CDN TLS certificates
- Deploys the DNS records for the CDN
- Provides pre-packaged edge function behaviors (e.g., URL rewrite rules)
- Configures request logging (optional)

## Limitations

- The domain names used for the CDN must be served by Route53 zones in the AWS account within which this module 
  is deployed. This zone must be deployed before using this module because this module automatically configures all the necessary DNS records.

- Your origin servers must be identified by domain name (not IP address) and be able to serve HTTPS traffic
  from their domain (i.e., have valid TLS certificates).

## Usage

### Overview

Conceptually, a CloudFront _distribution_ is a set of servers distributed all over the world that collectively comprise
a content distribution network (CDN). These servers
are called points-of-presence (PoPs). PoPs serve several purposes:

- Enhancing TLS performance by speeding up the initial connection between the client and server ([reference](https://www.imperva.com/learn/performance/cdn-and-ssl-tls/))
- Improving overall performance and reducing load on servers by caching responses from origin servers
- Running edge computations ([Lambda@Edge](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html))

Unlike traditional servers where DNS records such as `example.com` route
to a single set of servers, CloudFront works with AWS's DNS servers to ensure that clients are always routed
to the nearest PoP.

The set of domains that get routed this way is defined by the `domains` input to this module. How traffic gets
routed from the PoP to your origin servers is configured by `origin_configs`.

### Using the Global Provider

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

module "cdn" {
  source = "${var.pf_module_source}aws_cdn${var.pf_module_ref}"

  # Since the CDN operates globally, you must use the global
  # provider as follows:
  providers = {
    aws.global = aws.global
  }

  name            = "example"
  domains         = [...]
  origin_configs  = [...]
}

```

### Configuring Origin Routing

#### Overview

You can specify multiple upstream origins via `origin_configs`. Which origin traffic gets routed to
is controlled via `path_prefix`. Each origin must have a unique `path_prefix`.

Traffic that matches a given `path_prefix` will:

1. The CDN will check to see if the request path matches any of the `path_match_behavior` keys (e.g., `*.jpg`).
If so, the rules from that behavior configuration will be applied. See below.

2. If no `path_match_behavior` keys are matched (or none are provided), the `default_cache_behavior` configuration will take effect.

The cache "behavior" for both `default_cache_behavior` and `path_match_behavior` works as follows:

1. The `view_protocol_policy` ([docs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesViewerProtocolPolicy))
will be applied. [^2]

2. Any global redirect rules (see below) will take effect. Otherwise, the request will be processed.

3. If `caching_enabled` is `true`, the request's HTTP method is in `cached_methods`, and the request has a cached response, then a cached response will be immediately returned.

4. If no cached response is found and the request HTTP method is in `allowed_methods`, the request be forwarded 
to the `origin_domain` in its original form (including the original `Host` header) 
except for anything blocked by `cookies_not_forwarded`, `headers_not_forwarded`, and `query_strings_forwarded`.

5. When a response is received, CloudFront will [automatically compress responses](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html#compressed-content-cloudfront-how-it-works)
if `compression_enabled` is `true` and the client accepts either the Gzip or Brotli compression formats (via the `Accept-Encoding` HTTP header).

6. After optional compression, the request will be cached if `caching_enabled` is `true` and the request's HTTP method is in `cached_methods`.
The cache key is determined by `cookies_in_cache_key`, `headers_in_cache_key`, and `query_strings_in_cache_key` (the HTTP method and path are
always included in the key). [^1] 

   How long the request will stay cached depends on the following values and the response's [Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
   and [Expires](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires) headers:

   - `min_ttl`: The minimum amount of time in seconds that CloudFront will keep responses in the cache before revalidating them
   with the origin server.
   - `default_ttl`: The amount of time in seconds that CloudFront will keep responses in the cache **only** when the response
   does not supply `Cache-Control` or `Expires` headers.
   - `max_ttl`: The maximum amount of time in seconds that Cloudfront will keep responses in the cache before revalidating them
   with the origin server **regardless** of the response's `Cache-Control` or `Expires` headers.
   - `Cache-Control` response headers: CloudFront respects the `max-age`, `no-cache`, `no-store`, `private`, `stale-while-revalidate` and `stale-if-error`
   directives.
   - `Expires` response headers: Cloudfront respects this header but `Cache-Control` should be preferred due to its increased specificity.

   For a much more detailed breakdown of CloudFront caching, see [AWS's documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cache-key-understand-cache-policy.html).

7. The response will be sent to the client.

[^1]: The more values you specify for the cache key, the lower your hit ratio will be, so tune this carefully. By default,
we include all cookies and query strings in the cache key to ensure that responses are not unintentionally shared across
clients. You will likely want to loosen these settings for your specific scenario. For more information on tuning
the cache key see [this documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-the-cache-key.html).

[^2]: We default to `redirect-to-https` for backwards-compatibility, but it is more secure to use `https-only`. See
the documentation for [HTTP Strict Transport Security.](https://https.cio.gov/hsts/)

#### No Origin Matches

If the distribution receives a request but does not match any `path_prefix`, CloudFront will return an HTTP 404
status code.

#### Redirect Rules

We provide an input, `redirect_rules`, that allows you to specify redirects that will be applied *before* requests
get sent to your origin servers.

For example:

```hcl
redirect_rules = [{
   source = "https?://example.com(/.*)"
   target = "https://new.example.com$1"
}]
```

The above rule would redirect a request for `http://example.com/some/resource` to `https://new.example.com/some/rseource`.


### Number of PoPs

The number of PoPs is configured by CloudFront's [price class.](https://aws.amazon.com/cloudfront/pricing/) If you
are serving to non-NA clients, you may want to change the default `price_class` for this module.

### Origin Shield

By default, caching is performed independently at each PoP. That means if content is cached in one PoP, other PoPs
will still have to make requests to the origin server to retrieve that content.

If you enable [Origin Shield](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html),
an additional, unified caching layer is introduced before your origin servers. That means that if content is
cached for one PoP, it will be cached for all PoPs.

Be aware that this incurs additional charges that can be significant depending on your workload, and it is best
used for workloads that serve mostly static content. See [this documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html#origin-shield-costs).

### Security

#### Restricting Client Geographies

You can control what countries clients can connect to your distribution from by setting `geo_restriction_type`
and `geo_restriction_list`. For example, if you set `geo_restriction_type` to `"whitelist"` and `geo_restriction_list`
to `["US"]`, then only clients can connect from the United States. If you set `geo_restriction_type` to `"blacklist"`,
then client can connect from anywhere *but* the United States.


### Logging

Logging of requests can be enabled by setting `logging_enabled` to `true`.

This only configures [standard logging](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html),
not the more expensive [real-time logs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/real-time-logs.html).
As a result, logs may take up to an hour to be created in the S3 bucket (`outputs.log_bucket`).


### Invalidating the Cache

If you need to manually purge the distribution of all cached responses, you can do so
by following [this documentation.](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)