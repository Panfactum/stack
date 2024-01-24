# Kubernetes Reloader

This module equips our cluster with the [reloader](https://github.com/stakater/Reloader), a utility that refreshes Pods when configmaps or secrets they rely on change. It includes:
- A deployment for the reloader image
- A cluster role that gives the deployment permissions to manage and watch resources to refresh
- A cluster role binding that binds the above cluster role to the deployment service account

See the [vars file](./vars.tf) for descriptions of the input parameters.
