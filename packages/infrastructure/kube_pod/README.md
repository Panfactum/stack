# Kubernetes Pod Template

This module does **not** create a Kubernetes Pod but rather exposes a `pod_template` output
that is intended to by used by higher-level controllers such as Deployments and StatefulSets. This module
is used internally by many Panfactum submodules such as
[kube_deployment](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_deployment) and [kube_stateful_set](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_stateful_set).

## Usage

This module follows most of the conventions outlined in [this guide](/docs/main/guides/deploying-workloads/basics).