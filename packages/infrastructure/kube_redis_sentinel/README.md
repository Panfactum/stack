# Redis with Sentinel

**Type:** Live

This module deploys a highly-available set of [Redis](https://redis.io/docs/) nodes.

This is deployed in a single master, many replica configuration. Failover is handled
by [Redis Sentinel](https://redis.io/docs/management/sentinel/) which is also
deployed by this module.

## Extra Redis Configuration

You can add extra Redis configuration flags via the `redis_flags` module variable.

These flags are passed as commandline arguments to the redis servers. This ensures they
will be of the highest precedence.

For more information about passing flags through the commandline and available options,
see [this documentation](https://redis.io/docs/latest/operate/oss_and_stack/management/config/).

