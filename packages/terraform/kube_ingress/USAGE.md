## Usage

### Headers


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

### X-Content-Type-Options

We enforce browsers to respect the `Content-Type` header by setting
[X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options) to `nosniff`
by default.

Disable this by setting `x_content_type_options_enabled` to `false`.

### Legacy Headers

We set the following legacy headers to safe values by default, but
they can be overridden:

- [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options): `SAMEORIGIN`
- [X-XSS-Protection](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection): `1; mode=block`



