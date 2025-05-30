# Kubernetes VPA

This module provides a deployment of the [vertical-pod-autoscaler](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler) project.

## Usage

### Metrics History

Set `history_length_hours` to the number of hours of historical metrics that you want to use for the initial VPA
recommendations. 

Metrics are weighted based on an exponential decay algorithm so more recent data will be weighted more heavily
than older data. Metrics older than `history_length_hours` will no longer impact calculations.

If using Prometheus, 100 samples will be taken from this range in order to seed the internal VPA database. Do
not set `history_length_hours` to greater than 1 week as this will cause significant strain on the Prometheus instance.

### Using the Prometheus Backend

*Alpha Quality: Do not use*

The VPA can use Prometheus as the source of its recommendations when setting pod resources.
To enable this in the Panfactum stack:

- Ensure you have deployed [kube_monitoring](/edge/reference/infrastructure-modules/kubernetes/kube_monitoring). 
Note that `kube_monitoring` **must** have been deployed for at least `history_length_hours` 
in order for the VPA to work properly.

- Set `prometheus_enabled` to `true`.

- Add the `thanos_query_frontend_url` input from the `kube_monitoring` output.

- Apply the module.

- If you had previously deployed the VPA without Prometheus, delete all `Verticalpodautoscalercheckpoints`:
`kubectl delete -A verticalpodautoscalercheckpoints.autoscaling.k8s.io --all`.
