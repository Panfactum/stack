# Atlas MongoDB SSO with Authentik

This module sets up the Authentik Application and Provider for Atlas MongoDB.

## Sample Terragrunt Configuration

```hcl
include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "authentik_core" {
  config_path = "../authentik_core_resources"
}

dependency "kube_authentik" {
  config_path = "../kube_authentik"
}

inputs = {
  acs_url      = "https://auth.mongodb.com/sso/saml2/sample"
  issuer       = "https://authentik.sample.com"
  audience     = "https://www.okta.com/saml2/service-provider/sample"

  organization_name   = dependency.authentik_core.outputs.organization_name
  authentik_namespace = dependency.kube_authentik.outputs.namespace
  media_configmap     = dependency.kube_authentik.outputs.media_configmap
  authentik_domain    = dependency.kube_authentik.outputs.domain

  allowed_groups = [
    "superusers",
    "privileged_engineers",
    "engineers",
    "restricted_engineers",
    "billing_admins"
  ]
}
```

## Guide
### Initialize the module
1. Create a `authentik_atlas_mongodb_sso` module directory adjacent to the `authentik_core_resources` directory.
2. Create a `terragrunt.hcl` file in the `authentik_atlas_mongodb_sso` directory and include the sample above.
3. Replace the input `issuer` with your authentik domain url.
4. run `pf-tf-init`
5. run `terragrunt apply`

### Download the Signing Certificate
6. Login to your Authentik instance
7. Go to the `Admin` section
8. Click on `Applications` -> `Providers`
9. Find `Related objects` and click on the `Download` button for the `Download signing certificate`
10. Note the `SSO URL (POST)` string

### Configure the Atlas MongoDB Identity Provider
11. Login to your Atlas MongoDB account
12. Go to `Organization Settings` -> `Federated Authentication Settings`
13. Click on `Configure Identity Provider`
14. Select `Workforce Identity Federation`
15. Select `SAML for Atlas UI Access`
16. Set a Name: `Authentik Integration`
17. Set the `Issuer URI` as the `issuer` input from above
18. Set the `Single Sign-On URL` as the `SSO URL (POST)` that we noted above
19. Upload the `Signing Certificate` that we downloaded above 
20. Set the `Request Binding` to `HTTP-POST`
21. Set the `Response Signature Algorithm` to `SHA-256`
22. Continue to the next step
23. Note the `ACS URL`
24. Note the `Audience URI`

### Update the Module
25. Update the `acs_url` with the value from the `ACS URL`
26. Update the `audience` with the value from the `Audience URI`
27. run `terragrunt apply`

### Verify ability to login
28. Go back to Authentik and switch to the `User` view
29. Click on the `Login` button for `Atlas MongoDB`
30. You should be redirected to the Atlas MongoDB and automatically logged in
