# Kubernetes Node Image Cache Controller

This controller creates a DamonSet that creates a pod on each node filled with noop containers that use the images
that you wish to cache.

Many of the Panfactum modules have built-in integrations with this controller, and you can add additional
images to the cache by leveraging the [kube_node_image_cache](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_node_image_cache) submodule.