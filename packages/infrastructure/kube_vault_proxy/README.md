# Vault OAuth2 Proxy 

This module provides a deployment of the [OAuth2 Proxy](https://github.com/oauth2-proxy/oauth2-proxy)
that requires authentication with the cluster's Vault instance.

## Usage

### Setup

This module is intended to be used in conjunction with the [kube_ingress](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_ingress)
module. `domain` should be set to a domain used in `kube_ingress` and the `upstream_ingress_annotations` output
should be passed to the `extra_annotations` input of `kube_ingress`.

Once this is configured, request to the `kube_ingress` endpoints will trigger a request to an `oauth2-proxy` deployment
via the [NGINX external authentication stanza](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#external-authentication). Clients will be required
to authenticate with Vault before the main request is allowed to be forwarded to the upstream.

The authentication response is cached via a cookie so this sequence only occurs on the initial request, ensuring
the whole process adds very little overhead.

### Authorization

There are a few means to validate users. Each of these can be used simultaneously, and a user must meet **all**
the constraints to be authorized.

- **allowed_email_domains**: Email domains that are allowed (sourced from Authentik)
- **allowed_vault_roles**: The user's role in the cluster's Vault instance (one of `rbac-superusers`, `rbac-admins`, `rbac-readers`, `rbac-restricted-readers`)
