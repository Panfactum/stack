# Kubernetes Ingress

Our standard module for creating [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
resources in a Kubernetes cluster.

## Usage

### Basics

This module provides the ability to create a set of routing rules for a given set of domains (`var.domains`) using
Kubernetes Ingresses.

It works as follows:

1. For all domains in `domains`, ensure that a DNS record is configured to point to the domain to this cluster's NGINX
  ingress controller (via [kube_external_dns](/main/reference/infrastructure-modules/direct/kubernetes/kube_external_dns))
  and provide the ingress controller a TLS certificate for the domains
  (via [kube_cert_manager](/main/reference/infrastructure-modules/direct/kubernetes/kube_cert_manager)).

1. When the ingress controller receives a request to a domain in `domains`, first apply the rate limits and redirect rules.

1. Next, the request's path is compared to the `path_prefix` in every config of `ingress_configs`.
  If the request path is prefixed with `path_prefix`, use the settings in that config object. [^90]

1. Apply CORS handling, rewrite rules, and any other request modification before forwarding the request to the Kubernetes
  service indicated by the config's `service` and `service_port` values.

1. When receiving a response form the upstream, perform any response modifications before forwarding the response to the
initiating client.

[^90]: If multiple path prefixes match, the longest `path_prefix` value wins.

### TLS Certificates

[kube_cert_issuers](/main/reference/infrastructure-modules/submodule/kubernetes/kube_cert_issuers) provides a global
default cert for all covered domains and first-level subdomains (via [wildcard SANs](https://sectigostore.com/page/wildcard-san-certificates/)).
This is stored at `cert-manager/ingress-tls`.

However, if you need coverage for second-level or greater subdomains on the ingresses for this module, you will need
a dedicated TLS cert. To generate this cert, set `generate_cert_enabled` to `true`.

We use Let's Encrypt as the CA for your certificate requests. They provide certificates for free, but also impose
[rate limits](https://letsencrypt.org/docs/rate-limits/). If you need to raise your rate limits,
you can [submit a rate limits adjustment request](https://isrg.formstack.com/forms/rate_limit_adjustment_request).

### CDN

If you want to provide a [CDN](https://en.wikipedia.org/wiki/Content_delivery_network) in front of the created Ingresses
for performance and security improvements, see the [kube_aws_cdn](/main/reference/infrastructure-modules/submodule/kubernetes/kube_aws_cdn) module.

**Additionally, this module must be deployed with `cdn_mode_enabled` set to `true`.**

CDN configuration can be supplied via the `cdn` configuration field on each element of `ingress_configs`. The individual
settings are described in more detail [here](/main/reference/infrastructure-modules/submodule/aws/aws_cdn).

### Redirect Rules

You can use `redirect_rules` to perform pattern matching over the requested URLs to perform permanent or
temporary HTTP redirects.

For example, if `redirect_rules` is set to the following

```hcl
redirect_rules = [
  {
    source = "^https://vault.prod.panfactum.com(/.*)?$"
    target = "https://vault.panfactum.com$1"
    permanent = false
  }
]
```

then a request to `https://vault.prod.panfactum.com/some/path` would receive a `302` HTTP redirect response
to `https://vault.panfactum.com/some/path`.

Note that the `source` value can use regex capture groups (e.g., `(/.*)`) that can then be referenced in
`target` (e.g., `$1`).

### Rewrite Rules

You can use `rewrite_rules` in each `ingress_config` to rewrite the request's path _before_ forwarding to the request
to the upstream service.

Rewrite rules work as follows:

1. The appropriate configuration from `ingress_configs` is chosen based on its `path_prefix`.

1. Each rule in `rewrite_rules` is applied as follows. The request's path ***without the `path_prefix`*** is compared against the `match` regex. Iff
that regex matches, then the ***path after the `path_prefix`*** is transformed to `rewrite`. [^91] [^92] Regex capture groups are allowed in `match`
and can be used in `rewrite`.

1. Iff `remove_prefix` is `true`, prefix is removed from the request.

1. The request is then forwarded to the upstream service.

[^91]: If multiple rewrite rules match, the one with the longest `match` regex applies.

[^92]: Note that we do not allow transforming the entire path at this phase because that would impact which config
from `ingress_configs` would match. If you need that behavior, a `redirect_rule` would be more appropriate than
a `rewrite_rule`.

For example, consider a `kube_ingress` module with the following `ingress_configs` list:

```hcl
ingress_configs = [
  {
    path_prefix = "/a"
    remove_prefix = true
    rewrite_rules = [
      {
        match = "(.*)"
        rewrite = "/1$1"
      }
    ]
    service = "foo"
    port = 80
  }
]
```

If the ingress receives a request with path `/a/b/c`, then the path will be mutated to `/1/b/c` before being sent to `foo:80`.
If `remove_prefix` were false, then the path would be mutated to `/a/1/b/c` before being forwarded.

### Headers

#### CORS Headers

The NGINX instance can handle [CORS response headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
for the upstream server.

Set `cors_enabled` to `true` to begin CORS handling.

Variables prefixed with `cors_` control the behavior.

A few important notes:

- If cors handling is enabled, `OPTIONS` requests will not be forwarded to the upstream server.

- Our CORS handling this will overwrite any CORS headers returned from the upstream server.

- Due to [problems in the default NGINX ingress controller behavior](https://github.com/kubernetes/ingress-nginx/issues/8469),
  we implement our own CORS handling logic that fixes many issues in the default behavior. If you would
  rather use the default behavior, set `cors_native_handling_enabled` to `true`.

- As a convenience, by default we allow the following popular headers in `Access-Control-Allow-Headers`: `DNT`, `Keep-Alive`,
  `User-Agent`, `X-Requested-With`, `If-Modified-Since`, `Cache-Control`, `Content-Disposition`, `Content-Type`, `Range`,
  `Authorization`, `Cookies`, `Referrer`, `Accept`, `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`, `X-Suggested-File-Name`,
  `Cookie`. You can change this via `cors_allowed_headers`.

- As a convenience, by default we expose the following popular headers in `Access-Control-Expose-Headers`: `Content-Encoding`, `Date`,
  `Location`, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, `X-XSS-Protection`, `Vary`, `Cross-Origin-Response-Policy`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, `Content-Security-Policy`, `Referrer-Policy`. You can change this via `cors_exposed_headers`.

#### Content-Security-Policy

Set `csp_enabled` to `true` to begin adding
`Content-Security-Policy` headers to returned responses.

This is [highly recommended](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
to prevent XSS and packet sniffing attacks.

If the upstream
server sets a `Content-Security-Policy` header, NGINX will not override
it by default. To override the headers with the values from this module,
set `csp_override` to `true`.

Variables prefixed with `csp_` control the individual CSP directives.

These directives will **only** be set on HTML responses to prevent
unnecessary bandwidth as browsers will only use the CSP from the main
document. However, we provide the ability to specify the
non-HTML CSP headers via `csp_non_html` which expects the full policy
string. This can be useful for mitigating [these attacks](https://lab.wallarm.com/how-to-trick-csp-in-letting-you-run-whatever-you-want-73cb5ff428aa/).

#### Permissions-Policy

The [Permissions-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy) header instructs
the browser which features the containing document is allowed to use.

Set `permissions_policy_enabled` to `true` to set the `Permissions-Policy`
header on HTML responses.

If the upstream
server sets a `Permissions-Policy` header, NGINX will not override
it by default. To override the headers with the values from this module,
set `permissions_policy_override` to `true`.

Variables prefixed with `permissions_policy_` control the individual
permissions policies. By default, they are all disabled.

#### Referrer-Policy

Set the [Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy) via the `referrer_policy`
variable. The default is `no-referrer`.

#### CORS

NGINX can be configured to handle [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) requests
for the Ingress.

To enable this functionality, set `cors_enabled` to `true`.

To control the behavior of the CORS handling, see
the variables prefixed with `cors_`.

#### Cross-Origin Isolation

See [this guide](https://web.dev/articles/coop-coep) for the benefits
of enabled cross-origin isolation.

Set `cross_origin_isolation_enabled` to `true` to begin
setting the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`
headers and enable the `crossOriginIsolated` state in the underlying
webpages. [^1]


[^1]: The default setting for `cross_origin_opener_policy` is `same-origin`
which will break sites loading SSO pop-ups from different origins as it may
block communication between the two windows. Change
the value to `same-origin-allow-popups` to restore functionality.

#### X-Content-Type-Options

We enforce browsers to respect the `Content-Type` header by setting
[X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options) to `nosniff`
by default.

Disable this by setting `x_content_type_options_enabled` to `false`.

#### Legacy Headers

We set the following legacy headers to safe values by default, but
they can be overridden:

- [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options): `SAMEORIGIN`
- [X-XSS-Protection](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection): `1; mode=block`

#### Extra Static Headers

You can specify extra static headers via the `extra_response_headers` input object.



