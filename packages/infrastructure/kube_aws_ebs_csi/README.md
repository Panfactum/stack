# AWS EBS CSI Driver

This module provides the [CSI driver](https://kubernetes-csi.github.io/docs/introduction.html)
for provisioning [AWS EBS volumes](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volumes.html)
as [PVs](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) for pods in the cluster via
[aws-ebs-csi-driver](https://github.com/kubernetes-sigs/aws-ebs-csi-driver).

Additionally, this creates two base [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/):

- `ebs-standard`: Uses [EBS gp3 volumes](https://aws.amazon.com/ebs/general-purpose/). Is the default
  Storage Class if none is indicated.

- `ebs-standard-retained`: Uses [EBS gp3 volumes](https://aws.amazon.com/ebs/general-purpose/). Must be manually
  deleted which is useful for databases where you do not want to accidentally lose data.

## Usage

### Extra Storage Classes

You can create additional EBS-backed storage classes by providing the `extra_storage_classes` input.

See this reference document for [descriptions of the various parameters](https://github.com/kubernetes-sigs/aws-ebs-csi-driver/blob/master/docs/parameters.md).

All storage classes created by this module have the following properties:

- Creates volumes that use the [ext4 filesystem](https://en.wikipedia.org/wiki/Ext4)
- Uses encrypted volumes
- Allows [volume expansions](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#csi-volume-expansion) and
creates volumes that are eligible for autoresizing by the 
[PVC autoresizer](/docs/main/reference/infrastructure-modules/direct/kubernetes/kube_pvc_autoresizer)
- Have a [volume binding mode](https://kubernetes.io/docs/concepts/storage/storage-classes/#volume-binding-mode) of `WaitForFirstConsumer`
- Creates volumes that are named `{{ .PVCNamespace }}/{{ .PVCName }}` in AWS (via the `Name` tag)


