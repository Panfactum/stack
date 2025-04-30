<p align="center">
    <img src="https://panfactum.com/logo.svg" height="150" alt="Panfactum logo">
</p>

---

# Panfactum Framework
[![Discord](https://img.shields.io/discord/1230306857604616303?logo=discord&label=Discord)](https://discord.gg/MJQ3WHktAS)
[![CLA assistant](https://cla-assistant.io/readme/badge/Panfactum/stack)](https://cla-assistant.io/Panfactum/stack)

The Panfactum Framework is an integrated set of OpenTofu (Terraform) modules and local tooling aimed at providing
the best experience for building, deploying, and managing software on AWS and Kubernetes.

Check out our demos [here.](https://panfactum.com/stack/demo/live)

## Installation

If you'd like to add the Panfactum stack to your organization, see our [deployment guide.](https://panfactum.com/docs/edge/guides/bootstrapping/overview)

If you'd like to connect to an existing stack, see the [new user guide.](https://panfactum.com/docs/edge/guides/getting-started/overview)

## Structure

This repository contains the following components of the panfactum architecture which are all versioned
together to ensure internal consistency:

- [Panfactum Local Development Environment](packages/nix/mkDevShells)

- [Infrastructure Modules](packages/infrastructure)

- [Documentation Website](packages/website)

- [Reference Architecture](packages/reference)

- [Bastion Host](packages/bastion)

## Licensing

Unless an alternative license is supplied in a specific directory, all files in this repository
are governed by [this license](./LICENSE). If a directory contains an alternative license,
all files contained in that directory (and it's descendants) are governed by that alternative
license exclusively.

## Maintainers

- [fullykubed](https://github.com/fullykubed)

