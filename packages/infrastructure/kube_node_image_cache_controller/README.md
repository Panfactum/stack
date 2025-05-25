# Kubernetes Node Image Cache Controller

This controller has two different components:

1. Pinner: A DaemonSet that creates a pod on each node filled with sleep containers that use the images that you wish to cache.
1. Prepuller: A set of "prepull" pods (one per cached imaged) that get launched on every new node added to the cluster. Each pod
has a noop container that does nothing except immediately exit. This serves to "seed" the node with images as soon as it is created
and augments the pinner as the prepuller downloads all images in parallel while the pinner must download images serially (i.e., slowly). [^1]

[^1]: Multiple images in the same pod are [downloaded serially.](https://kubernetes.io/docs/concepts/containers/images/#serial-and-parallel-image-pulls)

Many of the Panfactum modules have built-in integrations with this controller, and you can add additional
images to the cache by leveraging the [kube_node_image_cache](/main/reference/infrastructure-modules/submodule/kubernetes/kube_node_image_cache) submodule.

## Debugging

### Image Pull Errors

The pods that this controller generates may create temporary `ErrImagePull` or `ImagePullBackoff` errors. 

This occurs when rates limits for AWS ECR (which is used for every image since ECR is used as a pull through cache) are exceeded due
to the number of images in the cache. Especially when new nodes are created, dozens of images may be downloaded from ECR
at once.

You can resolve this by requesting a [service quota](https://docs.aws.amazon.com/AmazonECR/latest/userguide/service-quotas.html) increase from AWS
for the following quotas:

- Rate of BatchGetImage requests
- Rate of GetDownloadUrlForLayer requests