# PostgreSQL Cluster on Kubernetes

import MarkdownAlert from "@/components/markdown/MarkdownAlert";

## Usage

### Storage

You must provide an initial storage amount for the database with `pg_initial_storage_gb`. This configures the size
of the underlying EBS volumes.

Once the database is running, the PVC autoresizer
(provided by [kube_pvc_autoresizer](/docs/main/reference/infrastructure-modules/direct/kubernetes/kube_pvc_autoresizer))
will automatically expand the EBS volumes once the free space
drops below `pg_storage_increase_threshold_percent` of the current EBS volume size.
The size of the EBS volume will grow by `pg_storage_increase_gb` on every scaling event until a maximum of `pg_storage_limit_gb`.

Note that a scaling event can trigger **at most once every 6 hours** due to an AWS limitation. As a result,
ensure that `pg_storage_increase_gb` is large enough to satisfy your data growth rate.

### Memory Tuning

By default, we tune the PostgreSQL memory settings in accordance with
[the EDB recommendations](https://www.enterprisedb.com/postgres-tutorials/how-tune-postgresql-memory) since EDB
is the original creator of CNPG.

However, PostgreSQL databases can be used to run such a wide array of workloads that you may want to tune
the settings further for your particular use case.

These three settings are the most important:

- `pg_work_mem_percent`: How much memory is set aside for intermediate calculations in a query (i.e., sorts, joins, etc.).
- `pg_max_connections`: How many simultaneous connections / queries you can run in the database.
- `pg_shared_buffers_percent`: How much of the memory given to the cluster is set aside for caching data so that
it does not need to be read from disk.

`pg_work_mem_percent` is the most important and most likely to slow down your complex queries. This parameter 
represents the total memory set aside for all connections for their query calculations. 

`pg_max_connections` is important as memory is allocated and limited on a *per-operation* basis.
As a result, the actual memory available to each query is roughly `pg_memory_mb * pg_work_mem_percent / pg_max_connections`. 
This is true regardless of whether you are
actually using the maximum number of connections. Therefore, if you are using the database
to run large analytical queries, you may want to lower the `pg_max_connections` value in order to allow each query to use more
of the working memory pool.

`pg_shared_buffers_percent` will not typically be a source of issues as the linux page cache will step in if
this value is not large enough. However, the internal PostgreSQL cache controlled by this value
will always be more performant than the generic page cache, so tuning this can help in some circumstances.

### Shutdowns and Failovers

Postgres has [three shutdown modes](https://www.postgresql.org/docs/current/server-shutdown.html):

- Smart Shutdown: Prevents new connections, but allows existing sessions to finish their work before
shutting down.
- Fast Shutdown: Prevents new connections and forces all existing sessions to abort safely before
shutting down.
- Immediate Shutdown: Immediately exits without doing normal database shutdown processing (including
forcibly killing sessions w/ doing graceful aborts). Forces a database recovery operation on the next 
startup.

The default behavior of this module is to do a fast shutdown with a 30-second timeout (`pg_switchover_delay`)
until an immediate shutdown is issued. 

When running with a replica, this results in at most 30 seconds of downtime if the primary
instance is terminated (the replicas are still readable); however, it will normally be around
5 seconds.

This is quite quick, but the downside is that any running queries on the primary will be immediately
terminated and not allowed to complete. You can increase the amount of time that running queries
are allowed to complete by increasing `pg_smart_shutdown_timeout`. However, this will increase the
time that *new* sessions cannot be made with database proportionally (i.e., setting `pg_smart_shutdown_timeout`
to `30` will allow 30 seconds for existing queries to complete but increase the amount of time that new
queries cannot be made to about 35 seconds). 

We generally recommend keeping
`pg_smart_shutdown_timeout` set to the default `1` (minimum allowed by CNPG) in order to minimize downtime. 
Instead of trying to ensure queries
will always complete, we recommend that you implement retry logic in your database client code. This will
not only add resilience to this particular scenario, but will also be beneficial in other failure modes.

For more information about shutdowns, please see the [CNPG documentation.](https://cloudnative-pg.io/documentation/1.23/instance_manager/)

### Disruptions

By default, failovers of PostgreSQL pods in this module can be initiated at any time. This enables the cluster to automatically
perform maintenance operations such as instance resizing, AZ re-balancing, version upgrades, etc. However, every time a PostgreSQL pod
is disrupted, running queries will be terminated prematurely and a short period of downtime might occur if the disrupted
pod is the primary instance (see the Shutdowns and Failovers section).

You may want to provide more control over when these failovers can occur, so we provide the following options:

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
This module provides outputs that will allow you to match certain subsets of pods for both PostgreSQL and PgBouncer.

For example: 

```hcl
module "database" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/kube_pg_cluster?ref=__PANFACTUM_VERSION_MAIN__" # pf-update
  ...
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "custom-pdb"
      namespace = module.database.namespace
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.database.cluster_match_labels # Selects all PostgreSQL pods
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
query that you do not want disrupted and then delete it upon completion.

#### Completely Disabling Voluntary Disruptions

Allowing the cluster to periodically initiate failovers of PostgreSQL is critical to maintaining system health. However,
there are rare cases where you want to override the safe behavior and disable voluntary disruptions altogether. Setting
the `voluntary_disruptions_enabled` to `false` will set up PDBs that disallow any voluntary disruption of either PostgreSQL
or PgBouncer pods. 

This is *strongly* discouraged. If limiting any and all potential disruptions is of primary importance you should instead:

- Create a one-hour weekly disruption window to allow *some* opportunity for automatic maintenance operations
- Ensure that `spot_instances_enabled` and `burstable_instances_enabled` are both set to `false`
- Connect through PgBouncer with `pgbouncer_pool_mode` set to `transaction`
- Set `enhanced_ha_enabled` to `true`

Note that the above configuration will significantly increase the costs of running PostgreSQL (2.5-5x) versus more
flexible settings. In the vast majority of cases, this is entirely unnecessary, so this should only be used as a last resort.

<MarkdownAlert severity="warning">
    Enabling PDBs either manually or via disruption windows will not prevent all forms of disruption, only *voluntary* ones. A voluntary
    disruption is one that is done through the [Eviction API](https://kubernetes.io/docs/concepts/scheduling-eviction/api-eviction/)
    and limited by the use of PDBs.

    An example of a non-voluntary disruption would be via spot node termination or resource constraints. As a result,
    you should still implement defensive coding practices in your client code to account for potential disruptions.
</MarkdownAlert>

### PostgreSQL Parameters

PostgreSQL comes with hundreds of parameters that can be used to customize its behavior. You
can see the full set of available values [here](https://cloudnative-pg.io/documentation/1.23/postgresql_conf), and you
can provide them to this module via `pg_parameters`.

This can be used overwrite any default settings this module provides.

### Extra Schemas

When initially created, the CNPG cluster has just one [schema](https://www.postgresql.org/docs/current/ddl-schemas.html)
(`public`) in the `app` database. However, you may choose to add more in the future.

If you do, you will need to add those schemas to the `extra_schemas` input. This will ensure that users and roles
created by the Vault auth system will have access to the objects in those schemas.

Note that this will NOT create the extra schemas; you should do that in your database migration scripts.