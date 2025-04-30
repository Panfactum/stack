# Argo Workflows

This module deploys Argo Workflows, a workflow engine for orchestrating parallel jobs on Kubernetes. It also includes Argo Events, which allows event-driven workflow automation.

## Features

- Argo Workflows for workflow orchestration
- Argo Events for event-driven workflow automation
- Integration with PostgreSQL for persistent workflow storage
- Secure by default with RBAC configuration
- Optional metric endpoints for Prometheus monitoring

## Usage

```hcl
module "argo" {
  source = "../kube_argo"
  
  argo_domain = "argo.example.com"
  vault_domain = "vault.example.com"
  
  # Enable monitoring
  monitoring_enabled = true
  metrics_enabled = true
  service_monitor_enabled = true
  service_monitor_namespace = "monitoring"
  service_monitor_labels = {
    "release" = "prometheus"
  }
}
```

## Prometheus Metrics

This module can expose Prometheus metrics for both Argo Workflows and Argo Events. To enable metrics:

1. Set `metrics_enabled = true` to expose the metrics endpoints
2. Set `service_monitor_enabled = true` to create ServiceMonitor resources for Prometheus Operator
3. Configure `service_monitor_namespace` and `service_monitor_labels` as needed for your Prometheus setup

```hcl
module "argo" {
  source = "../kube_argo"
  
  argo_domain = "argo.example.com"
  vault_domain = "vault.example.com"
  
  # Enable metrics
  metrics_enabled = true
  service_monitor_enabled = true
  service_monitor_namespace = "monitoring"
  service_monitor_labels = {
    "release" = "prometheus"
  }
  
  # Optional: customize metrics configuration
  metrics_service_port = 9090
  metrics_service_port_name = "metrics"
  metrics_path = "/metrics"
  metrics_scrape_interval = "30s"
}
```

### Metrics Configuration Details

The metrics configuration is applied differently for Argo Workflows and Argo Events:

- **Argo Workflows**: Metrics are configured at the controller level using the `metricsConfig` section
- **Argo Events**: Metrics are configured separately for both the controller and webhook components

Both components will expose metrics endpoints when enabled, and ServiceMonitor resources will be created if configured.

### Available Metrics

When enabled, the following types of metrics are available:

- Workflow execution metrics (counts, durations)
- Controller metrics (operation latencies, queue sizes)
- Event processing metrics (event counts, trigger counts)
- Custom workflow metrics (can be defined in workflow templates)

### Monitoring Dashboard

For a comprehensive monitoring dashboard, you can use the [Argo Workflows Grafana Dashboard](https://grafana.com/grafana/dashboards/13927-argoworkflow-metrics/).

## Variables

| Name | Description | Type | Default |
|------|-------------|------|---------|
| argo_domain | The domain to use for the Argo UI | string | n/a |
| vault_domain | The domain of the Vault instance running in the cluster | string | n/a |
| metrics_enabled | Whether to enable Prometheus metrics | bool | false |
| metrics_service_port | Service port for the metrics endpoint | number | 9090 |
| metrics_service_port_name | Service port name for the metrics endpoint | string | "metrics" |
| metrics_path | The path where metrics are exposed | string | "/metrics" |
| metrics_scrape_interval | How frequently Prometheus should scrape metrics | string | "30s" |
| service_monitor_enabled | Whether to create ServiceMonitor resources | bool | false |
| service_monitor_namespace | Namespace for ServiceMonitor resources | string | "" |
| service_monitor_labels | Additional labels for ServiceMonitor resources | map(string) | {} |
| monitoring_enabled | Whether to add active monitoring to the deployed systems | bool | false |
| sla_target | SLA level (1-3) | number | 3 |
