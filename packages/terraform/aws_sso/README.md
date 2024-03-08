# AWS SSO

**Type:** Live

1. Connects Okta to [AWS SSO](https://aws.amazon.com/single-sign-on/) via the [AWS SSO pre-configured app](https://saml-doc.okta.com/SAML_Docs/How-to-Configure-SAML-2.0-for-AWS-Single-Sign-on.html)
   and [SCIM provisioning](https://docs.aws.amazon.com/singlesignon/latest/userguide/okta-idp.html).
2. Creates the three core permission tiers for each AWS account:
   1. `superusers` - Maps to the `arn:aws:iam::aws:policy/AdministratorAccess`
   2. `admins` - Maps to a role that has admin access to most items but attempts to block permissions that could create obvious security problems or delete key infrastructure
   3. `readers` - Read-only access to the specific subset of AWS resources used at Bambee
3. Maps Okta groups to a permission tier (or none) for each AWS account

## Maintainer Notes

1. You have to enable AWS SSO in the root account via the web console before applying this module 
   for the first time. 

2. The SAML metadata document from the IdP needs to be uploaded to AWS MANUALLY.

3. SCIM provisioning must be configured MANUALLY. Group assignments won't work until this step is completed.

4. The user portal URL needs to be configured MANUALLY in the aws web console in the SSO settings.

5. The group PUSH settings need to be configured MANUALLY in AAD.
