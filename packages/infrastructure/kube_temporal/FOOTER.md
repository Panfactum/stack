## Usage

This module deploys a self-hosted [Temporal](https://temporal.io/) workflow orchestration platform on Kubernetes.

Temporal provides durable, fault-tolerant workflow execution for distributed systems. This module follows Panfactum conventions for reliability, observability, and security.

### Components Deployed

- **Temporal Frontend** — Client-facing gRPC service (port 7233)
- **Temporal History** — Workflow execution history service (port 7234)
- **Temporal Matching** — Task queue matching service (port 7235)
- **Temporal Worker** — System workflow worker service (port 7239)
- **Temporal Web UI** — Browser-based observability interface (port 8080)
- **PostgreSQL** — Persistence and visibility store via CloudNativePG

### Connecting Your Applications

Use the `frontend_host` and `frontend_port` outputs to configure your Temporal SDK clients:

```go
client, err := client.Dial(client.Options{
  HostPort: fmt.Sprintf("%s:%d", frontendHost, frontendPort),
})
```

### Important Notes

- The `num_history_shards` variable **cannot be changed** after the initial deployment without a full data migration.
- The `default` Temporal namespace is automatically created during deployment.