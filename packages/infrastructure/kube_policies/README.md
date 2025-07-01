# Panfactum Policies for Kyverno

This module installs a handful of default Kyverno policies that enable better and more production-hardened defaults
in the Kubernetes cluster.

[kube_kyverno](/docs/main/reference/infrastructure-modules/direct/kubernetes/kube_kyverno) must be installed
in order for this module to work.

## Priority Classes

This module also sets up additional priority classes in addition to the default ones provided
by Kubernetes:

- `database` (`10000000`): Used for running stateful pods

- `default` (`0`): The global default priority class

- `cluster-important` (`100000000`): Used for controllers that provide ancillary
  (but not critical) cluster functionality

Additionally, you can set up arbitrary additional priority classes as needed via the `extra_priority_classes` input.

## Maintainer Notes

### Resource Generation Script

The `generate_resources.sh` script is used to generate the `resources.txt` file, which contains a comprehensive list of all Kubernetes API resources available in the cluster, grouped by their API group.
