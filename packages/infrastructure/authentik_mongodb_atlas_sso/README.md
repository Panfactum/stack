# Authentik MongoDB Atlas SSO

This module configures Authentik for integration with MongoDB Atlas.

## Guide

### Deploy MongoDB Atlas Provider & Application in Authentik

1. Add a new a `authentik_mongodb_atlas_sso` folder adjacent to your `authentik_core_resources` folder.
1. Add a new a `terragrunt.hcl` file that looks like this:

    ::: code-group labels=[authentik_mongodb_atlas_sso/terragrunt.hcl]
    ```hcl collapse={1-9} "REPLACE_ME"
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
        organization_name = dependency.authentik_core.outputs.organization_name
        authentik_domain  = dependency.kube_authentik.outputs.domain
        
        # Replace AFTER "Setup MongoDB Atlas Identity Provider"
        # with the `ACS URL`
        # Example: https://auth.mongodb.com/sso/saml2/0oaw7vqdsehzxtqZ1297
        acs_url  = "REPLACE_ME"

        # Replace AFTER "Setup MongoDB Atlas Identity Provider"
        # with the `Audience URI`
        # Example: https://www.okta.com/saml2/service-provider/spzsbkposqvrzhbjcdnz
        audience = "REPLACE_ME"

    }
    ```
    :::  

1. Run `pf-tf-init`
1. Run `terragrunt apply`

### Setup MongoDB Atlas Identity Provider

Please follow the steps defined in the [MongoDB Atlas Identity Provider](/docs/main/reference/infrastructure-modules/direct/authentik/mongodb_atlas_identity_provider) and resume here. 

### Sync Authentik with the Atlas Settings

![ACS & Audience URL](doc_images/mongodb-atlas-identity-providers-acs-url.png)

1. Copy and set the `ACS URL` from the MongoDB Atlas Identity Provider setup to the `acs_url` input.
1. Copy and set the `Audience URI` from the MongoDB Atlas Identity Provider setup to the `audience` input.
1. Run `terragrunt apply`

### Test the Integration

1. Go to your Authentik instance
1. Find the mongodb atlas application
1. Click and confirm that you are able to login