# Airbyte

This module deploys Airbyte onto a Kubernetes cluster with a focus on AWS infrastructure, though it can be adapted for other cloud providers.

## Scope and Connectors

This module only deploys the core Airbyte engine components required for the platform to function. It does not include or configure any source or destination connectors, which must be installed separately after deployment. The Airbyte platform provides a connector catalog within its user interface where administrators can install the specific connectors needed for their data integration workflows.

To install connectors:

1. After deployment, log in to the Airbyte UI using the credentials provided
2. Navigate to the "Sources" or "Destinations" section
3. Search for and install the required connectors from the catalog

For custom connector development, this module includes the Connector Builder Server component, which provides a development environment for creating and testing custom connectors to meet specialized integration needs.

If you need to pre-install specific connectors or automate connector configuration, consider implementing additional Terraform modules that interact with the Airbyte API after core deployment is complete.

## Usage

1. Create a new directory adjacent to your `aws_eks` module called `kube_airbyte`.
2. Add a `terragrunt.hcl` file to the directory that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/kube_airbyte/terragrunt.hcl).
3. Run `pf-tf-init` to enable the required providers
4. Run `terragrunt apply`.

## Authentication

The module uses Vault for authentication when ingress is enabled, providing secure access to the Airbyte UI.