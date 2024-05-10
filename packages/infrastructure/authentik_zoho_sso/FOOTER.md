## Usage

### Sign-in URL

For IDP-initiated logins, the `zoho_sign_in_url` variable must be provided.

This is not found in the Zoho web UI and must be constructed manually.

It is of the form `https://accounts.zoho.com/samlauthrequest/<domain>?serviceurl=<zoho_service>` where

- `<domain>` is a domain **that has been verified with Zoho**

- `<zoho_service>` is the `https` url of a Zoho service (e.g., `https://one.zoho.com`)