# Kubernetes StatefulSet

import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

Provides a production-hardened instance of a Kubernetes [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
with the following enhancements:

- Automatic headless service creation
- Standardized resource labels
- Pod and container security hardening
- Persistent volume creation and mounting with automatic integrations with the 
- [PVC Autoresizer](https://github.com/topolvm/pvc-autoresizer) and [Velero](https://github.com/vmware-tanzu/velero)
- Temporary directory mounting
- [ConfigMap](https://kubernetes.io/docs/concepts/configuration/configmap/) and [Secret](https://kubernetes.io/docs/concepts/configuration/secret/) mounting
- [Downward-API](https://kubernetes.io/docs/concepts/workloads/pods/downward-api/) integrations
- Service account configuration with default permissions
- Integration with the Panfactum bin-packing scheduler
- High-availability scheduling constraints
- [Readiness and liveness probe](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) configurations
- Automatic reloading via the [Reloader](https://github.com/stakater/Reloader)
- [Vertical pod autoscaling](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
- [Pod disruption budget](https://kubernetes.io/docs/tasks/run-application/configure-pdb/)
- [Toleration](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) switches for the various Panfactum node classes

## Usage

### Basics

This module follows the basic workload deployment patterns describe in [this guide](/main/guides/deploying-workloads/basics).

### Horizontal Autoscaling

By default, this module does not have horizontal autoscaling built-in. If you wish
to add horizontal autoscaling via the [HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
(or similar controller), you should set `ignore_replica_count` to `true` to prevent
this module from overriding the replica count set via horizontal autoscaling.

### Persistence

One of the core use cases for a StatefulSet is the ability to persistent data across
pod restarts through the use of [Persistent Volume Claims (PVCs)](https://kubernetes.io/docs/concepts/storage/persistent-volumes/).

You can configure the StatefulSet's PVCs via the `volume_mounts` input. This input
is a map of names (arbitrary) to configuration values for each volume that should mounted to every
pod in the StatefulSet.

The configuration values are as follows:

- `storage_class`: The [Storage Class](https://kubernetes.io/docs/concepts/storage/storage-classes/) to
use for the volume. To learn more about the available storage class options, see [our guide.](/main/guides/deploying-workloads/persistence)
- `initial_size_gb`: The size of the volume when it is first created.
- `increase_gb`: How much the volume will grow every time it is autoscaled by the [PVC autoresizer](https://github.com/topolvm/pvc-autoresizer).
- `increase_threshold_percent`: When free storage drops below this percent on the volume, the volume will be autoscaled.
- `size_limit_gb`: The maximum size the volume is allowed to grow to.
- `mount_path`: Absolute path inside each container that the volume is mounted to.
- `backups_enabled`: Whether the PVC snapshots will be created when [Velero](https://github.com/vmware-tanzu/velero) backups are created (by default hourly).

<MarkdownAlert severity="warning">
    PVCs can only be autoscaled every six hours (AWS limitation), so you must choose autoscaling parameters
    that ensure autoscaling can keep pace with your data growth rate.
</MarkdownAlert>

You can configure the [retention policy](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#persistentvolumeclaim-retention)
of the volumes through the `volume_retention_policy` input.
