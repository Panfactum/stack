## Usage

### Create / Delete

This module does **not** register domains but rather adopts domains
that you have already registered and updates their information.
Additionally, destroying this module does un-register the domains;
it only removes them from the terraform state.

### Contact Information

There are three different domain contacts:

- Registrant: The owner of the domain
- Admin: The person responsible for administrative decisions about the domain
- Tech: The person responsible for executing changes for the domain

It is possible for the same person to serve multiple roles.

These people will be contacted in the case of billing issues, abuse, or required
changes. Their information is **not** publicly available, but will be made
available to the registrar (AWS).