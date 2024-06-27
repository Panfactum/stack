# PVC Autoresizer

This module provides support for automatically expanding PVCs via the [pvc-autoresizer](https://github.com/topolvm/pvc-autoresizer) project.


## Custom Image

We provide our own images for the autoresizer because the upstream project only provides images
that are compatible with amd64 system architectures. Our image is multi-platform and allows
the autoresizer to run on arm64 nodes.

As a result, the `pvc_autoresizer_version` needs to be set to a commit hash that we have actually
built. Not all commit hashes from the upstream project are available.