# Kubernetes trust-manager

This module create a deployment of cert-manager's 
[trust-manager](https://cert-manager.io/docs/trust/trust-manager/).

trust-manager is a single-purpose utility with copies X.509 CA trust bundles
to every namespace in the cluster so that they can be consumed by various workloads.
This is particularly useful for distributing CA certificates for a service mesh.
