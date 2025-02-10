# Grist

import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

This module deploys a [Grist](https://support.getgrist.com/) instance to the Kubernetes cluster.

## Usage

### Auth

When you first set up Grist, you will set a `root_email`. This should be _your_ email address as this will provide
you the necessary permissions to configure the Grist instance via the Web UI.

While *authentication* is linked to Panfactum SSO (via Vault), permissions for each user must be manually set within
Grist. In other words, a user's ability to access Grist will be gated by central Panfactum IdP, but the
permissions assigned thereafter are not automatically computed as in many of the other Panfactum-managed systems.

Note that when you first install Grist, your name will be set to "Support." You can change this manually in the web UI. All other
users will have their names automatically set when they first log in.

<MarkdownAlert severity="warning">
    If you lose access to the `root_email`, you may lose admin access to your Grist instance. Be sure to
    add additional owners if the `root_email` must change. See [warning](https://support.getgrist.com/self-managed/#changing-the-value-of-grist_default_email).
</MarkdownAlert>

