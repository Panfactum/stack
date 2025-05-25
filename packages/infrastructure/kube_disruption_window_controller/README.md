# Disruption Window Controller

The Disruption Window Controller is a Panfactum-created addon that periodically enables voluntary disruptions
by setting a PDB's `maxUnavailable` field to a non-zero value and then subsequently disables voluntary
disruptions after some time by setting `maxUnavailable` to `0`. The period where disruptions are enabled is
referred to as the *disruption window.*

There may be many instances of this submodule running in the cluster and each is namespace-scoped. For example,
we make use of this submodule in our database modules (e.g., [kube_pg_cluster](/main/reference/infrastructure-modules/submodule/kubernetes/kube_pg_cluster)).

The controller will search for all PDBs in its namespace with the **label** `panfactum.com/voluntary-disruption-window-id` set to the
`disruption_window_id` output from this module. Disruption windows will begin at the times indicated by the `cron_schedule` module input. 

Disruption windows may be configured via **annotations** on the PDBs:

- `panfactum.com/voluntary-disruption-window-seconds`: The **minimum** number of seconds that the disruption window 
will last. The **maximum** amount of time will be this value plus an additional 900 seconds (15 minutes). Defaults to `3600`.

- `panfactum.com/voluntary-disruption-window-max-unavailable`: During the disruption window, the PDB's `maxUnavailable` field
will be set to this value. Defaults to `1`.

## Architecture

This addon is simply two CronJobs:

- One runs on the `cron_schedule` and enables the disruption window by running
the Panfactum CLI command `pf-voluntary-disruptions-enable`.

- The other runs every 15 minutes and attempts to disable
disruption windows that have exceeded a PDB's `panfactum.com/voluntary-disruption-window-seconds` annotation by running the
Panfactum CLI command `pf-voluntary-disruptions-disable`.
