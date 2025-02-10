# Authentik MongoDB Atlas SSO

This module sets up the Authentik Application and Provider for MongoDB Atlas.

## Guide

This guide will walk you through setting up the Authentik side of the MongoDB Atlas SSO integration. 

### Deploy MongoDB Atlas Provider & Application in Authentik

1. Add a new a `authentik_atlas_mongodb_sso` folder adjacent to your `authentik_core_resources` folder.
2. Add a new a `terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/authentik_mongodb_atlas_sso/terragrunt.hcl).
3. Replace the input `issuer` with your authentik domain url.
4. run `pf-tf-init`
5. run `terragrunt apply`

### Setup MongoDB Atlas Identity Provider

Please follow the steps defined in the [MongoDB Atlas Identity Provider](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/infrastructure-modules/direct/mongodb/mongodb_atlas_identity_provider) and resume here. 

1. Copy and set the `ACS URL` from the MongoDB Atlas Identity Provider setup to the `acs_url` input.
2. Copy and set the `Audience URI` from the MongoDB Atlas Identity Provider setup to the `audience` input.
3. run `terragrunt apply`

### Test the Integration

1. go to your Authentik instance
2. find the mongodb atlas application
3. click and confirm that you are able to login