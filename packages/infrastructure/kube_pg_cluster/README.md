# PostgreSQL Cluster on Kubernetes

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

`pg_max_connections` is important as memory is allocated and limited on a *per-connection* basis.
As a result, the actual memory available to each query is `pg_memory_mb * pg_work_mem_percent / pg_max_connections`. 
This is true regardless of whether you are
actually using the maximum number of connections. Therefore, if you are using the database
to run large analytical queries, you may want to lower the `pg_max_connections` value in order to allow each query to use more
of the working memory pool.

`pg_shared_buffers_percent` will not typically be a source of issues as the linux page cache will step in if
this value is not large enough. However, the internal PostgreSQL cache controlled by this value
will always be more performant than the generic page cache, so tuning this can help in some circumstances.

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