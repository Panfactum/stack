# NATS JetStream

Applying this module will bring up a NATS JetStream cluster that can undergo leader election but for some reason cannot recieve connections. (They always error with i/o timeout).

Adding 6222 (the port used for cluster communications) as an opaque port somehow breaks the clustering behavior.