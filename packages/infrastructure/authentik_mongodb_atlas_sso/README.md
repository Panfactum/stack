# Authentik MongoDB Atlas SSO

This module configures Authentik for integration with MongoDB Atlas.

## Guide

### Deploy MongoDB Atlas Provider & Application in Authentik

1. Add a new a `authentik_mongodb_atlas_sso` folder adjacent to your `authentik_core_resources` folder.
2. Add a new a `terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/authentik_mongodb_atlas_sso/terragrunt.hcl).
3. Run `pf-tf-init`
4. Run `terragrunt apply`

### Setup MongoDB Atlas Identity Provider

Please follow the steps defined in the [MongoDB Atlas Identity Provider](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/infrastructure-modules/direct/mongodb/mongodb_atlas_identity_provider) and resume here. 

### Sync Authentik with the Atlas Settings

![img.png](img.png)

1. Copy and set the `ACS URL` from the MongoDB Atlas Identity Provider setup to the `acs_url` input.
2. Copy and set the `Audience URI` from the MongoDB Atlas Identity Provider setup to the `audience` input.
3. Run `terragrunt apply`

### Test the Integration

1. Go to your Authentik instance
2. Find the mongodb atlas application
3. Click and confirm that you are able to login