# Redis with Sentinel

**Type:** Live

This module deploys a highly-available set of [Redis](https://redis.io/docs/) nodes.

This is deployed in a single master, many replica configuration. Failover is handled
by [Redis Sentinel](https://redis.io/docs/management/sentinel/) which is also
deployed by this module.