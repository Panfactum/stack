# CNPG PDB Deleter

Due to this [issue](https://github.com/cloudnative-pg/cloudnative-pg/issues/2570),
the postgres primaries running in the cluster can never be disrupted by the kubernetes
eviction API. This prevents our automations from doing automatic updates or autoscaling.

This module provides a cronjob that patches those PDBs as an interim solution until
PDB configuration is added to the cnpg cluster resources.
