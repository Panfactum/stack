import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

# Mongodb Atlas MongoDB Identity Provider

This module sets up the identity provider configuration in MongoDB Atlas.

<MarkdownAlert severity="warning">
  Due to limitations with MongoDB Atlas, users will not be automatically removed from MongoDB Atlas when they are removed from Authentik.

They will lose the ability to login, but you should be aware of the following caveats:

- If "Bypass SAML Mode" is enabled, users will be able to bypass Authentik and login directly to Atlas using their
  static usernames and passwords. As a result, we strongly recommend keeping this flag disabled.
- Any active session tokens that the user has with the Atlas web UI will not be automatically revoked. Until these
  tokens expire, the user may still have the ability to interact with the web UI unless you manually remove them from
  the Atlas organization.
- Atlas application keys are not scoped to a user's account. If the user had access to these keys, they may still be
  able to access Atlas even after their account is removed. As a result, ensure that you rotate application keys if
  removing a user in the `superusers` or `privileged_engineers` group (and any other group configured with access to application keys).
  </MarkdownAlert>

## Panfactum Role to MongoDB Atlas Role Mapping

This document outlines the default role mappings between **Panfactum Roles** and **MongoDB Atlas Roles**. The mappings
ensure that users in Panfactum have appropriate permissions in MongoDB Atlas, maintaining security and role-based access
control.

For more details on MongoDB Atlas roles, refer to the official documentation:  
[MongoDB Atlas User Roles](https://www.mongodb.com/docs/atlas/reference/user-roles/)

| **Panfactum Role**       | **MongoDB Atlas Role(s)** | **Reason for Mapping**                                                                                                                       |
|--------------------------|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| **superusers**           | `ORG_OWNER`               | Superusers require full administrative access to the MongoDB Atlas organization, including user management, billing, and resource creation.  |
| **privileged_engineers** | `ORG_OWNER`               | Privileged engineers act as admins, enabling them to fully manage Atlas independently without relying on Panfactum.                          |
| **billing_admins**       | `ORG_BILLING_ADMIN`       | Billing admins manage payment details and invoices but do not need full administrative control over the organization.                        |
| **engineers**            | `ORG_READ_ONLY`           | Engineers require read-only access to view Atlas organization settings but cannot modify any configurations.                                 |
| **restricted_engineers** | `ORG_MEMBER`              | Restricted engineers have basic membership access, allowing them to work within assigned projects but without organization-wide privileges.  |

## Guide

### Pre-req: Setup MongoDB Atlas Identity Provider Domain Verification

1. Go to your MongoDB Atlas account
2. Go to `Organization Settings` -> `Federated Authentication Settings` -> `Domains`
3. Click on `Add Domain`
   ![img.png](doc_images/img.png)
4. Add the root domain that you are using for Authentik (i.e., panfactum.com)
5. Select `DNS Record` as the verification method
   ![img_2.png](doc_images/img_2.png)
6. Note the `TXT Record` that is generated. You will need this value in future steps.
   ![img_1.png](doc_images/img_1.png)

### Deploy a new DNS TXT Record & Verify

1. Add a text record to your `global/aws_dns/terragrunt.hcl` file that looks
   like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/global/aws_dns_records/terragrunt.hcl).
2. Run `terragrunt apply`
3. Go back to MongoDB Atlas and click on `Verify` next to the domain you added
4. Confirm verification

### Download the Signing Certificate from Authentik

Before proceeding, make sure to have downloaded the signing certificate from the Authentik application

1. Login to your Authentik instance
2. Switch over to the `Admin` section
   ![img_3.png](doc_images/img_3.png)
3. Go to the section `Applications` -> `Providers` -> `MongoDB Atlas`
4. Find `Related objects` and click on the `Download` button for the `Download signing certificate`
   ![img_4.png](doc_images/img_4.png)

### Deploy the MongoDB Identity Provider module

Unfortunately, the terraform provider for MongoDB Atlas does not support the creation of the Identity Provider but
allows for modifications.
We will first create the resource through the UI and then import it to configure further.

#### From MongoDB Atlas UI

1. Go to `Organization Settings`
2. Note the `Organization ID`. You will need this value in future steps.
3. Go to `Federated Authentication Settings` -> `Identity Providers`
4. Click on `Configure Identity Provider`
   ![img_5.png](doc_images/img_5.png)
5. Select `Workforce Identity Federation`
6. Select `SAML for Atlas UI Access`
7. Set a Name such as `Authentik Integration`
8. Click on `Fill with placeholder values` for the Issuer URI and Single Sign-On URL
   ![img_7.png](doc_images/img_7.png)
9. Upload the `Signing Certificate` that we downloaded above
10. Set the `Request Binding` to `HTTP-POST`
11. Set the `Response Signature Algorithm` to `SHA-256`
12. Continue to the next step and note these values as you will need them in future steps.
    * `ACS URL`
    * `Audience URI`
    * `IdP ID`
    * `Federation Settings ID` (Found in the url
      `https://cloud.mongodb.com/v2#/federation/<this-is-your-federation-settings-id>/overview`)

#### Create Access Keys

1. Go to `Organization Settings` -> `Access Manager`
2. Click on `Applications` tab
3. Click on `Add new`
4. Set the description to `terraform`
5. Set the Organization Permission to `Organization Owner`
6. Save the public and private key to your `.env` file
    1. Set `MONGODB_ATLAS_PUBLIC_KEY`
    2. Set `MONGODB_ATLAS_PRIVATE_KEY`

#### Optional: CICD

If you have CICD setup and deploying infrastructure using the [wf_tf_deploy] module, you will also need to pass in the
keys.

1. Update your CICD module var to accept the keys as inputs
   like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/infrastructure/demo-cicd/vars.tf)
2. Update the `wf_tf_deploy` module and pass in the secrets inputs
   like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/infrastructure/demo-cicd/tf_deploy.tf)
3. Add them to the `secrets.yaml`
   like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/demo-cicd/secrets.yaml)
4. Utilize and pass them in as inputs
   like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/demo-cicd/terragrunt.hcl)

#### From the terminal

1. Add a new a `mongodb_atlas_identity_provider` folder adjacent to your `authentik_core_resources` folder
2. Add a new a `terragrunt.hcl` file that looks
   like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/mongodb_atlas_identity_provider/terragrunt.hcl)
3. Set the `federation_settings_id` to the value from above
4. Set the `organization_id` to the value from above
5. Set the `idp_id` to the value from above
6. Set the `associated_domains` by adding the domain you verified above to the list
7. Set the `sso_debug_enabled` to `true`
8. Run `pf-tf-init`
9. Run `terragrunt apply`

If you are following the `authentik_mongodb_atlas_sso` module guide, please return and resume
the [Sync Authentik with the Atlas Settings](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/infrastructure-modules/direct/authentik/authentik_mongodb_atlas_sso)`
section.

### Disable SSO Bypass

After you have confirmed and validated that SSO is working through Authentik, disable the Bypass SAML Mode toggle by updating the `sso_debug_enabled` to `false` in the `mongodb_atlas_identity_provider` module.

<MarkdownAlert severity="warning">
  You MUST verify that SSO works prior to disabling the bypass. 
  Disabling this toggle will lock you out of your MongoDB Atlas account if you have not configured SSO correctly.
  If you do lock yourself out, rest assured you can still recover by contacting their support, but it can take 1-2 days.
</MarkdownAlert>