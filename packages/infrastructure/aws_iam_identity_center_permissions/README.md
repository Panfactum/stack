# AWS IAM Identity Center Permissions

Creates the three core permission tiers for each AWS account:

   1. `superusers`: Maps to the `arn:aws:iam::aws:policy/AdministratorAccess` managed policy.
   2. `admins`: Maps to a role that has admin access to most items, 
   but attempts to block permissions that could create obvious security problems or delete key infrastructure.
   3. `readers`: Read-only access to the specific subset of AWS resources used in the Panfactum stack.
   4. `restricted_readers`: Same as `readers` but prevents reading sensitive values.
   5. `billing_admins`: Allows a user to control payment and billing settings but not live infrastructure.

## Usage

### Adjusting Session Durations

There are two different expiration times to keep in mind when using AWS IAM Identity Center:

- The AWS session expiration time: How often you need to get a new AWS session token
- The SAML authentication expiration time: How often you need to re-authenticate with your upstream IdP

When using tools like the AWS CLI, AWS sessions will automatically be renewed *so long as your SAML
authentication is not expired*.

As a result, the SAML authentication expiration time is going to be the value that most impacts your
user ergonomics. To adjust this value, you will need to follow [this guide](https://docs.aws.amazon.com/singlesignon/latest/userguide/configure-user-session.html#user-session-duration-how-to-configure).

Since it automatically renews, we recommend keeping the AWS session expiration time fairly short (1 hour). This
provides a small improvement to security as this decreases the useful lifetime of stolen session tokens. You
can adjust the value via the `session_duration_hours` input.