# Redis with Sentinel

This module deploys a highly-available set of [Redis](https://redis.io/docs/) nodes.

This is deployed in a single master, many replica configuration. Failover is handled
by [Redis Sentinel](https://redis.io/docs/management/sentinel/) which is also
deployed by this module.

## Persistence

Redis provides two mechanisms for persistence: 
[AOF and RDB](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/).
This module uses RDB by default (tuned via `redis_save`).

Using AOF concurrently with RDB negates the ability to do [partial resynchronizations after restarts
and failovers](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/#partial-sync-after-restarts-and-failovers). Instead, a copy of the database must be transferred from the current master to new replicas. This greatly increases
the time-to-recover as well as incurs a high network cost. In fact, there is arguably no benefit to AOF-based persistence 
at all with our replicated architecture as new Redis nodes will always pull their data from the running master, not 
from their local AOF. The only benefit would be if _all_ Redis nodes simultaneously failed with 
a non-graceful shutdown (an incredibly unlikely scenario).

Persistence is always enabled in this module for similar reasons. Without persistence, an entire copy of the database would
have to be transferred from the master to each replica on every Redis node restart. The cost of storing
data on disk is far less than the network costs associated with this transfer. Moreover, persistence should
never impact performance as writes are completed asynchronously.

## Extra Redis Configuration

You can add extra Redis configuration flags via the `redis_flags` module variable.

These flags are passed as commandline arguments to the redis servers. This ensures they
will be of the highest precedence.

For more information about passing flags through the commandline and available options,
see [this documentation](https://redis.io/docs/latest/operate/oss_and_stack/management/config/).

