# PostgreSQL Cluster on Kubernetes

import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

## Usage

### Database Version

The PostgreSQL version can be controlled via the `pg_version` string. The version MUST be one a valid tag of an image
from the [CNPG container repository.](https://github.com/cloudnative-pg/postgres-containers/pkgs/container/postgresql)

The default value for `pg_version` is the one that we test in our clusters, so we recommend starting there.

<MarkdownAlert severity="warning">
    At this time, major version upgrades are not supported for existing clusters (coming soon). Minor version upgrades will be applied
    automatically when `pg_version` is changed.
</MarkdownAlert>

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
    These credentials are **unsafe** to use as they are not automatically rotated without re-applying
    this module.
</MarkdownAlert>

### Connecting

The below example show how to connect to the PostgreSQL cluster through 
the read-write PgBouncer using dynamically rotated admin credentials by setting various
environment variables in our [kube_deployment](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_deployment) module.

```hcl
module "database" {
  source = "${var.pf_module_source}kube_pg_cluster${var.pf_module_ref}"
  ...
}

module "deployment" {
  source = "${var.pf_module_source}kube_deployment${var.pf_module_ref}"
  ...
  
  common_env_from_secrets = {
    POSTGRES_USERNAME = {
      secret_name = module.database.admin_creds_secret
      key = "username"
    }
    POSTGRES_PASSWORD = {
      secret_name = module.database.admin_creds_secret
      key = "password"
    }
  }
  common_env = {
    POSTGRES_HOST = module.database.pooler_rw_service_name
    POSTGRES_PORT = module.database.pooler_rw_service_port
  }
}
```

### Storage

You must provide an initial storage amount for the database with `pg_initial_storage_gb`. This configures the size
of the underlying EBS volumes.

Once the database is running, the PVC autoresizer
(provided by [kube_pvc_autoresizer](/docs/main/reference/infrastructure-modules/direct/kubernetes/kube_pvc_autoresizer))
will automatically expand the EBS volumes once the free space
drops below `pg_storage_increase_threshold_percent` of the current EBS volume size.
The size of the EBS volume will grow by `pg_storage_increase_gb` on every scaling event until a maximum of `pg_storage_limit_gb`.

<MarkdownAlert severity="warning">
    Note that a scaling event can trigger **at most once every 6 hours** due to an AWS limitation. As a result,
    ensure that `pg_storage_increase_gb` is large enough to satisfy your data growth rate.
</MarkdownAlert>

### Resource Allocation

The resources (CPU and memory) given to each PostgreSQL node is automatically scaled by the Vertical Pod Autoscaler when `vpa_enabled` is `true` (the default). You
can control the ranges of the resources allocated to the pods via the following inputs:

* `pg_minimum_memory_mb`
* `pg_maximum_memory_mb`
* `pg_minimum_cpu_millicores`
* `pg_maximum_cpu_millicores`

Similarly, resources given to the PgBouncer instances are controlled via:

* `pgbouncer_minimum_memory_mb`
* `pgbouncer_maximum_memory_mb`
* `pgbouncer_minimum_cpu_millicores`
* `pgbouncer_maximum_cpu_millicores`

If `vpa_enabled` is `false`, the actual resource requests and limits will be set to the minimums.

<MarkdownAlert severity="warning">
    You should take care to tune the memory minimums appropriately, especially for bursty workloads. If you are regularly
    issuing queries that take more than twice the 95th percentile memory utilization, you must manually set `pg_minimum_memory_mb` to
    a sensible value for your workloads as the VPA will under-provision resources.

    Additionally, you should review our section on memory tuning below.
</MarkdownAlert>

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

### Synchronous Replication

By default, this module *asynchronously* replicates data written to the primary instance to each replica. This ensures
that writes can be completed relatively quickly and that writes can continue even if the replicas are unavailable. 

Generally, this is safe. On a shutdown or failover of the primary, writes 
are paused and replicas are given a chance to catch up with the primary before one of them is promoted.

However, there are a few drawbacks:

- In the case of a catastrophic instance failure on the primary (e.g., power outage), there is a possibility
of data loss (up to roughly 5 seconds).

- If you are reading from the replicas, you may be reading stale data (up to roughly 5 seconds old).

- About 5 seconds of additional downtime must be accounted for on failovers in order to allow the replicas to catch-up.

To avoid these drawbacks, you can set `pg_sync_replication_enabled`. However, this comes with its own tradeoffs:

- Database mutations will take significantly longer because writes must be distributed across every replica before returning successfully.

- Database mutations will not complete unless *all* replicas are available. This will increase the chance of downtime for write operations.

We advise you to stick with the default asynchronous replication unless you have a specific, demonstrated need for synchronous replication.

### Recovery

In the case of an emergency, you can recover the database from the backups and WAL archives stored in S3.

Complete the following steps:

1. Run `kubectl cnpg status -n <cluster_namespace> <cluster_name>`. Verify that there exists a "First Point of
Recoverability". 

    If this is not available, that means that your logical PostgreSQL backups were not configured correctly and 
    are not available. You will need to restore from the hourly EBS snapshots 
    created by Velero instead.

2. Retrieve the `backup_directory` output from this module by running `terragrunt output`.

3. Delete the cluster resource manually via `kubectl delete clusters.postgresql.cnpg.io -n <cluster_namespace> <cluster>`.

4. Set the `pg_recovery_mode_enabled` module input to `true` and the `pg_recovery_directory` to the `backup_directory` output you retrieved in step 2.

    Optionally, you can set the `pg_recovery_target_time` to an [RFC 3339](https://datatracker.ietf.org/doc/html/rfc3339)
    timestamp (e.g., `2023-08-11T11:14:21.00000+00`) to recover the database to a particular point in time. This
    must be **after** the "First Point of Recoverability" that was reported in step 1.

    If `pg_recovery_target_time` is not provided, the database will be recovered to the latest data stored in S3 which
    should be within 5 seconds of the last database write.

5. Set the `pg_backup_directory` module input to anything **other than** the `backup_directory` output you retrieved in step 2. This ensures
that the new cluster will not use overwrite the existing backup directory and instead create a new one.

6. Re-apply the module that contains this submodule and wait for the recovery to complete. The database should successfully
come back online.

7. When the recovered database is back online, an initial backup of the new database will be performed. You can monitor it's progress
from the `:backups.postgresql.cnpg.io` in k9s. When this complete, you should see a "First Point of
Recoverability" when running `kubectl cnpg status -n <cluster_namespace> <cluster_name>`. If an initial backup cannot be created,
something has gone wrong, and you should restart the recovery process.

8. After the initial backup for the recovered database is created, you can optionally delete the `pg_recovery_directory` directory from the S3 bucket
provided by the `backup_bucket_name` output. This can save space as that old backup is no longer needed.

<MarkdownAlert severity="info">
  Note that the "First Point of Recoverability" is determined by the `backups_retention_days`
  input; backups older than `backups_retention_days` (default `3`) will be deleted, and you
  will no longer be able to recover to that point in time.

  For more information on recovery procedures, see the CNPG 
  [recovery documentation](https://cloudnative-pg.io/documentation/1.25/recovery/).
</MarkdownAlert>

<MarkdownAlert severity="info">
  Note that you can optionally restore from an alternate backup bucket by setting the `pg_recovery_bucket` input.
  This can be useful if you are trying to set up a new forked database from running system.
</MarkdownAlert>

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
  source = "${var.pf_module_source}kube_pg_cluster${var.pf_module_ref}"
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