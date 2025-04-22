# OpenSearch

import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

This module deploys a highly-available install of [OpenSearch](https://opensearch.org/).

## Usage

### Credentials

For in-cluster applications, credentials can be sourced from the following Kubernetes Secrets named in the module's outputs:

- `superuser_creds_secret`: Full access to the cluster, including the ability to manage sensitive settings like replication and permissions
- `admin_creds_secret`: Read and write access to all indices including the ability to configure index settings
- `reader_creds_secret`: Read-only access to all indices

Authenticating with OpenSearch is done via [x.509 authentication.](https://docs.opensearch.org/docs/latest/security/authentication-backends/client-auth/)
Each of the above named Secrets contains the following values:

- `ca.crt`: The CA certificate used to verify the server-provided certificate.
- `tls.crt`: The certificate that the OpenSearch client should provide to the server for authentication.
- `tls.key`: The TLS key that the OpenSearch client will use for securing communications with the server.

The credentials in each Secret are managed by Vault and rotated automatically before they expire. In the Panfactum
Stack, credential rotation will automatically trigger a pod restart for pods that reference the credentials.

The credential lifetime is configured by the `vault_credential_lifetime_hours` input (defaults
to 16 hours). Credentials are rotated 50% of the way through their lifetime. Thus, in the worst-case,
credentials that a pod receives are valid for `vault_credential_lifetime_hours` / 2.

### Connecting

The below example show how to connect to the OpenSearch cluster
using dynamically rotated admin credentials by mounting the client certificates 
in our [kube_deployment](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_deployment) module.

```hcl
module "opensearch" {
  source = "${var.pf_module_source}kube_opensearch${var.pf_module_ref}"
  ...
}

module "deployment" {
  source = "${var.pf_module_source}kube_deployment${var.pf_module_ref}"
  ...
  
  secret_mounts = {
    "${module.opensearch.admin_creds_secret}" = {
      mount_path = "/etc/opensearch-certs"
    }
  }
  
  common_env = {
    OPENSEARCH_HOST = module.opensearch.host
    OPENSEARCH_PORT = module.opensearch.client_port
  }
}
```

Note that you also must configure the client to use the certificates. For example, if using the [opensearch NPM package](https://www.npmjs.com/package/@opensearch-project/opensearch):

```typescript
import { Client } from "@opensearch-project/opensearch";
import { readFileSync } from "fs";

const client = new Client({
  node:`http://${process.env.OPENSEARCH_HOST}:${process.env.OPENSEARCH_PORT}`,
  ssl: {
    ca: readFileSync("/etc/opensearch-certs/ca.crt"),
    cert: readFileSync("/etc/opensearch-certs/tls.crt"),
    key: readFileSync("/etc/opensearch-certs/tls.key")
  },
});
```

### Persistence

TODO once upstream issue is merged

### Disruptions

TODO: adjust once the flexible topology is enabled

#### Disruption Windows

Disruption windows provide the ability to confine disruptions to specific time intervals (e.g., periods of low load) if this is needed
to meet your stability goals. You can enable this feature by setting `voluntary_disruption_window_enabled` to `true`.

The disruption windows are scheduled via `voluntary_disruption_window_cron_schedule` and the length of time of each
window via `voluntary_disruption_window_seconds`.

If you use this feature, we *strongly* recommend that you allow disruptions at least once per day, and ideally more frequently.

For more information on how this works, see the
[kube_disruption_window_controller](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_disruption_window_controller)
submodule.

#### Completely Disabling Voluntary Disruptions

Allowing the cluster to periodically initiate restarts of OpenSearch nodes is critical to maintaining system health. However,
there are rare cases where you want to override the safe behavior and disable voluntary disruptions altogether. Setting
the `voluntary_disruptions_enabled` to `false` will set up PDBs that disallow any voluntary disruption of any OpenSearch
pod in this module.

This is *strongly* discouraged. If limiting any and all potential disruptions is of primary importance you should instead:

- Create a one-hour weekly disruption window to allow *some* opportunity for automatic maintenance operations
- Ensure that `spot_instances_enabled` and `burstable_instances_enabled` are both set to `false`

Note that the above configuration will significantly increase the costs of running the OpenSearch cluster (2.5-5x) versus more
flexible settings. In the vast majority of cases, this is entirely unnecessary, so this should only be used as a last resort.

<MarkdownAlert severity="warning">
    Enabling PDBs either manually or via disruption windows will not prevent all forms of disruption, only *voluntary* ones. A voluntary
    disruption is one that is done through the [Eviction API](https://kubernetes.io/docs/concepts/scheduling-eviction/api-eviction/)
    and limited by the use of PDBs.

    An example of a non-voluntary disruption would be via spot node termination or resource constraints. As a result,
    you should still implement defensive coding practices in your client code to account for potential disruptions.
</MarkdownAlert>
