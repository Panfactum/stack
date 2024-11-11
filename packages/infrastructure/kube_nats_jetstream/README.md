# NATS JetStream

Applying this module will bring up a NATS JetStream cluster that can undergo leader election but for some reason cannot recieve connections. (They always error with i/o timeout).

Adding 6222 (the port used for cluster communications) as an opaque port somehow breaks the clustering behavior.

The config doesn't reload, so you have to tear down and re-deploy to update the cluster.

If you'd like to see what client connection attempts look like you can uncomment the event source.

Argo Event's connection configuration in Go can be seen here: https://github.com/argoproj/argo-events/blob/master/pkg/eventbus/jetstream/base/jetstream.go#L55.