# Redis with Sentinel

import MarkdownAlert from "@/components/markdown/MarkdownAlert";

This module deploys a highly-available set of [Redis](https://redis.io/docs/) nodes.

This is deployed in a single master, many replica configuration. Failover is handled
by [Redis Sentinel](https://redis.io/docs/management/sentinel/) which is also
deployed by this module.

## Usage

### Credentials

For in-cluster applications, credentials can be sourced from the following Kubernetes Secrets named in the module's outputs:

- `superuser_creds_secret`: Complete access to the database
- `admin_creds_secret`: Read and write access to the database (does not include the ability to preform sensitive operations like schema or permission manipulation)
- `reader_creds_secret`: Read-only access to the database

Each of the above named Secrets contains the following values:

- `username`: The username to use for authentication
- `password`: The password to use for authentication

The credentials in each Secret are managed by Vault and rotated automatically before they expire. In the Panfactum
Stack, credential rotation will automatically trigger a pod restart for pods that reference the credentials.

The credential lifetime is configured by the `vault_credential_lifetime_hours` input (defaults
to 16 hours). Credentials are rotated 50% of the way through their lifetime. Thus, in the worst-case,
credentials that a pod receives are valid for `vault_credential_lifetime_hours` / 2.

<MarkdownAlert severity="warning">
    The module also supplies `root_username` and `root_password` outputs for the root user of the database.
    These credentials are **unsafe** to use as they are not automatically rotated.
</MarkdownAlert>

### Connecting

The below example show how to connect to the Redis master
using dynamically rotated admin credentials by setting various
environment variables in our [kube_deployment](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_deployment) module.

```hcl
module "redis" {
  source = "${var.pf_module_source}kube_redis_sentinel${var.pf_module_ref}"
  ...
}

module "deployment" {
  source = "${var.pf_module_source}kube_deployment${var.pf_module_ref}"
  ...
  
  common_env_from_secrets = {
    REDIS_USERNAME = {
      secret_name = module.redis.admin_creds_secret
      key = "username"
    }
    REDIS_PASSWORD = {
      secret_name = module.redis.admin_creds_secret
      key = "password"
    }
  }
  common_env = {
    REDIS_HOST = module.redis.redis_master_host
    REDIS_PORT = module.redis.redis_port
  }
}
```

### Persistence

Redis provides two mechanisms for persistence: 
[AOF and RDB](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/).
This module uses RDB by default (tuned via `redis_save`).

Using AOF (whether independently or concurrently with RDB) negates the ability to do [partial resynchronizations after restarts
and failovers](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/#partial-sync-after-restarts-and-failovers). Instead, a copy of the database must be transferred from the current master to restarted or new replicas. This greatly increases
the time-to-recover as well as incurs a high network cost. In fact, there is arguably no benefit to AOF-based persistence 
at all with our replicated architecture as new Redis nodes will always pull their data from the running master, not 
from their local AOF. The only benefit would be if _all_ Redis nodes simultaneously failed with 
a non-graceful shutdown (an incredibly unlikely scenario).

Persistence is always enabled in this module for similar reasons. Without persistence, an entire copy of the database would
have to be transferred from the master to each replica on every Redis node restart. The cost of storing
data on disk is far less than the network costs associated with this transfer. Moreover, persistence should
never impact performance as writes are completed asynchronously unless configured otherwise.

Once the Redis cluster is running, the PVC autoresizer
(provided by [kube_pvc_autoresizer](/docs/main/reference/infrastructure-modules/direct/kubernetes/kube_pvc_autoresizer))
will automatically expand the EBS volumes once the free space
drops below `persistence_storage_increase_threshold_percent` of the current EBS volume size.
The size of the EBS volume will grow by `persistence_storage_increase_gb` on every scaling event until a maximum of `persistence_storage_limit_gb`.

<MarkdownAlert severity="warning">
    Note that a scaling event can trigger **at most once every 6 hours** due to an AWS limitation. As a result,
    ensure that `persistence_storage_increase_gb` is large enough to satisfy your data growth rate.
</MarkdownAlert>

### Disruptions

By default, failovers of Redis pods in this module can be initiated at any time. This enables the cluster to automatically
perform maintenance operations such as instance resizing, AZ re-balancing, version upgrades, etc. However, every time a Redis pod
is disrupted, a short period of downtime might occur if the disrupted
pod is the master instance.

While this can generally be mitigated when using a [Sentinel-aware client](https://redis.io/docs/latest/develop/reference/sentinel-clients/),
you may want to provide more control over when these failovers can occur, so we provide the following options:

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
  source = "${var.pf_module_source}kube_redis_sentinel${var.pf_module_ref}"
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

Allowing the cluster to periodically initiate failovers of Redis is critical to maintaining system health. However,
there are rare cases where you want to override the safe behavior and disable voluntary disruptions altogether. Setting
the `voluntary_disruptions_enabled` to `false` will set up PDBs that disallow any voluntary disruption of any Redis
pod in this module.

This is *strongly* discouraged. If limiting any and all potential disruptions is of primary importance you should instead:

- Create a one-hour weekly disruption window to allow *some* opportunity for automatic maintenance operations
- Ensure that `spot_instances_enabled` and `burstable_instances_enabled` are both set to `false`

Note that the above configuration will significantly increase the costs of running the Redis cluster (2.5-5x) versus more
flexible settings. In the vast majority of cases, this is entirely unnecessary, so this should only be used as a last resort.

<MarkdownAlert severity="warning">
    Enabling PDBs either manually or via disruption windows will not prevent all forms of disruption, only *voluntary* ones. A voluntary
    disruption is one that is done through the [Eviction API](https://kubernetes.io/docs/concepts/scheduling-eviction/api-eviction/)
    and limited by the use of PDBs.

    An example of a non-voluntary disruption would be via spot node termination or resource constraints. As a result,
    you should still implement defensive coding practices in your client code to account for potential disruptions.
</MarkdownAlert>

### Extra Redis Configuration

You can add extra Redis configuration flags via the `redis_flags` module variable.

These flags are passed as commandline arguments to the redis servers. This ensures they
will be of the highest precedence.

For more information about passing flags through the commandline and available options,
see [this documentation](https://redis.io/docs/latest/operate/oss_and_stack/management/config/).

