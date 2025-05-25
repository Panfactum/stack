# PVC Annotator

The PVC Annotator is a Panfactum-created addon that periodically applies a set of labels
and annotations to PVCs in the same PVC group.

A "PVC group" is a set of PVCs in the same namespace with the same value for the 
`panfactum.com/pvc-group` label.

This module exists to solve the issue of `volumeClaimTemplate` immutability in common
controllers such as [StatefulSets](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.29/#statefulset-v1-apps). In other words, once a controller such as a StatefulSet
has been created, the labels and annotations for its PVCs can never be updated. This
makes it difficult to adjust PVC settings that depend on PVC labels and annotations
such as those for [Velero](https://velero.io/) or the
[PVC Autoresizer](https://github.com/topolvm/pvc-autoresizer).

## Architecture

This addon is very simple. It simply implements a Kyverno policy that adds the indicated labels and annotations
to the PVCs.

## Usage Notes

We make extensive use of this submodule in our core Panfactum modules such as in
[kube_stateful_set](/main/reference/infrastructure-modules/submodule/kubernetes/kube_stateful_set).

Most of the time you will not need to use this directly. However, we expose it in case you
are using a controller that creates PVCs that is not included in the stack.
