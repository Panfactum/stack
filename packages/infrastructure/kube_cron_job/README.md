# Kubernetes CronJob

Provides a production-hardened instance of a Kubernetes [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
with the following enhancements:

- Standardized resource labels
- Pod and container security hardening
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

This module follows the basic workload deployment patterns describe in [this guide](/docs/main/guides/deploying-workloads/basics).

### Scheduling

This module's has inputs that map one-for-one to the [standard Kubernetes CronJob API.](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.29/#cronjobspec-v1-batch)