# Kubernetes Node Settings

**Type:** Internal

This module is intended to setup the `user-data.toml` that Bottlerocket OS uses to launch.

The configuration settings are documented [here](https://github.com/bottlerocket-os/bottlerocket).

This should be shared across the static EKS node groups
as well as nodes provisioned via other autoscaling
mechanisms such as Karpenter.
