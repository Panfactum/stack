## Usage

- The cluster nodes won't be able to register with the cluster until the [kube_rbac module](https://github.com/BambeeHR/access-control/tree/main/terraform/kube_rbac) in access-control is deployed. That module
  allows the node IAM role to assume the correct Kubernetes permissions for
  node registration.


