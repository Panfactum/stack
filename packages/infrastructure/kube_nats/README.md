# NATS Jetstream

import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

This module deploys a highly-available [NATS cluster](https://nats.io/) running in [Jetstream mode.](https://docs.nats.io/nats-concepts/jetstream)

## Usage

### Credentials

For in-cluster applications, credentials can be sourced from the following Kubernetes Secrets named in the module's outputs:

- `superuser_creds_secret`: Full access to the [system account](https://docs.nats.io/running-a-nats-service/configuration/sys_accounts) (does not have access to normal data, so should generally be avoided)
- `admin_creds_secret`: Read and write access to the data streams
- `reader_creds_secret`: Read-only access to the data streams

Authenticating with NATS is done via [TLS authentication.](https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_intro/tls_mutual_auth)
Each of the above named Secrets contains the following values:

- `ca.crt`: The CA certificate used to verify the server-provided certificate.
- `tls.crt`: The certificate that the NATS client should provide to the server for authentication.
- `tls.key`: The TLS key that the NATS client will use for securing communications with the server.

The credentials in each Secret are managed by Vault and rotated automatically before they expire. In the Panfactum
Stack, credential rotation will automatically trigger a pod restart for pods that reference the credentials.

The credential lifetime is configured by the `vault_credential_lifetime_hours` input (defaults
to 16 hours). Credentials are rotated 50% of the way through their lifetime. Thus, in the worst-case,
credentials that a pod receives are valid for `vault_credential_lifetime_hours` / 2.

### Connecting

<MarkdownAlert severity="warning">
    Note that you should generally never want to use the superuser role. While this role has access to system events, it does
    NOT have access to the individual data streams due to a limitation in NATS resource isolation.
</MarkdownAlert>

The below example show how to connect to the NATS cluster
using dynamically rotated admin credentials by mounting the client certificates 
in our [kube_deployment](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_deployment) module.

```hcl
module "nats" {
  source = "${var.pf_module_source}kube_nats${var.pf_module_ref}"
  ...
}

module "deployment" {
  source = "${var.pf_module_source}kube_deployment${var.pf_module_ref}"
  ...
  
  secret_mounts = {
    "${module.nats.admin_creds_secret}" = {
      mount_path = "/etc/nats-certs"
    }
  }
  
  common_env = {
    NATS_HOST = module.nats.host
    NATS_PORT = module.nats.client_port
    
    # It is not strictly necessary to set these, but these are used by the NATS CLI,
    # so it can be helpful to have these set in case you need to debug.
    NATS_URL = "tls://${module.nats.host}:${module.nats.client_port}"
    NATS_KEY = "/etc/nats-certs/tls.key"
    NATS_CERT = "/etc/nats-certs/tls.crt"
    NATS_CA = "/etc/nats-certs/ca.crt"
  }
}
```

Note that you also must configure the client to use the certificates. For example, if using the [nats NPM package](https://www.npmjs.com/package/nats):

```typescript
import { connect } from "nats";

const nc = await connect({
  servers: process.env.NATS_HOST,
  port: process.env.NATS_PORT,
  tls: {
    keyFile: process.env.NATS_KEY,
    certFile: process.env.NATS_CERT,
    caFile: process.env.NATS_CA,
  } 
});
```

### Persistence

With NATS Jetstream, persistence is configured via [Streams](https://docs.nats.io/nats-concepts/jetstream/streams) which
allow you to control how messages are stored and what the limits of retention are. You can have many different streams
on the same NATS instance.

This module only creates the NATS server, not the internal streams. Your services should perform any necessary stream setup
before launching (similar to database migrations for other data stores).

That said, there are a few global storage settings to be aware of when first creating the cluster:

- `persistence_initial_storage_gb` (can not be changed after NATS cluster creation)
- `persistence_storage_limit_gb`
- `persistence_storage_increase_threshold_percent`
- `persistence_storage_increase_gb`
- `persistence_storage_class_name` (can not be changed after NATS cluster creation)

Once the NATS cluster is running, the PVC autoresizer
(provided by [kube_pvc_autoresizer](/docs/main/reference/infrastructure-modules/direct/kubernetes/kube_pvc_autoresizer))
will automatically expand the EBS volumes once the free space
drops below `persistence_storage_increase_threshold_percent` of the current EBS volume size.
The size of the EBS volume will grow by `persistence_storage_increase_gb` on every scaling event until a maximum of `persistence_storage_limit_gb`.

<MarkdownAlert severity="warning">
    Note that a scaling event can trigger **at most once every 6 hours** due to an AWS limitation. As a result,
    ensure that `persistence_storage_increase_gb` is large enough to satisfy your data growth rate.
</MarkdownAlert>

### Disruptions

By default, shutdown of NATS pods in this module can be initiated at any time. This enables the cluster to automatically
perform maintenance operations such as instance resizing, AZ re-balancing, version upgrades, etc. However, every time a NATS pod
is disrupted, clients connected to that instance will need to re-establish a connection with the NATS cluster.

While this generally does not cause issues, you may want to provide more control over when these failovers can occur, so we provide the following options:

#### Disruption Windows

Disruption windows provide the ability to confine disruptions to specific time intervals (e.g., periods of low load) if this is needed
to meet your stability goals. You can enable this feature by setting `voluntary_disruption_window_enabled` to `true`.

The disruption windows are scheduled via `voluntary_disruption_window_cron_schedule` and the length of time of each
window via `voluntary_disruption_window_seconds`.

If you use this feature, we *strongly* recommend that you allow disruptions at least once per day, and ideally more frequently.

For more information on how this works, see the
[kube_disruption_window_controller](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_disruption_window_controller)
submodule.

#### Custom PDBs

Rather than time-based disruption windows, you may want more granular control of when disruptions are allowed and disallowed.

You can do this by managing your own [PodDisruptionBudgets](https://kubernetes.io/docs/tasks/run-application/configure-pdb/).
This module provides outputs that will allow you to match certain subsets of Redis pods.

For example:

```hcl
module "redis" {
  source = "${var.pf_module_source}kube_nats${var.pf_module_ref}"
  ...
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "custom-pdb"
      namespace = module.redis.namespace
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.redis.match_labels_master # Selects only the Redis master (writable) pod
      }
      maxUnavailable = 0 # Prevents any disruptions
    }
  })
  force_conflicts   = true
  server_side_apply = true
}
```

While this example is constructed via IaC, you can also create / destroy these PDBs directly in your application
logic via YAML manifests and the Kubernetes API. This would allow you to create a PDB prior to initiating a long-running
operation that you do not want disrupted and then delete it upon completion.

#### Completely Disabling Voluntary Disruptions

Allowing the cluster to periodically initiate replacement of NATS pods is critical to maintaining system health. However,
there are rare cases where you want to override the safe behavior and disable voluntary disruptions altogether. Setting
the `voluntary_disruptions_enabled` to `false` will set up PDBs that disallow any voluntary disruption of any NATS
pod in this module.

This is *strongly* discouraged. If limiting any and all potential disruptions is of primary importance you should instead:

- Create a one-hour weekly disruption window to allow *some* opportunity for automatic maintenance operations
- Ensure that `spot_instances_enabled` and `burstable_instances_enabled` are both set to `false`

Note that the above configuration will significantly increase the costs of running the NATS cluster (2.5-5x) versus more
flexible settings. In the vast majority of cases, this is entirely unnecessary, so this should only be used as a last resort.

<MarkdownAlert severity="warning">
    Enabling PDBs either manually or via disruption windows will not prevent all forms of disruption, only *voluntary* ones. A voluntary
    disruption is one that is done through the [Eviction API](https://kubernetes.io/docs/concepts/scheduling-eviction/api-eviction/)
    and limited by the use of PDBs.

    An example of a non-voluntary disruption would be via spot node termination or resource constraints. As a result,
    you should still implement defensive coding practices in your client code to account for potential disruptions.
</MarkdownAlert>

