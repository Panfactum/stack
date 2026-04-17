# Panfactum OpenTofu / Terraform Provider

A utility provider used in the [Panfactum Stack.](https://github.com/Panfactum/stack)

## Contributing

### Testing Changes Locally

If you want to test provider changes using local IaC, you can do that by executing the following steps:

1. Add a `.terraformrc` to your IaC repository with the following values. Change `<path_to_this_repo>`
to an absolute path to the local copy of this provider repository on your local machine.

    ```hcl
    provider_installation {

        dev_overrides {
            "panfactum/pf" = "<path_to_this_repo>/go/bin"
        }

        # For all other providers, install them directly from their origin provider
        # registries as normal. If you omit this, Terraform will _only_ use
        # the dev_overrides block, and so no other providers will be available.
        direct {}
    }
    ```

2. Set the `TF_CLI_CONFIG_FILE` to an absolute path to the above `.terraformrc` file.

3. Make any desired updates to the provider code.

4. After anytime you make code updates, run `go install` to make the new provider binary available to your local IaC.

### Release Process

The release process is configured according
to the [publishing guide provided by Hashicorp](https://developer.hashicorp.com/terraform/registry/providers/publishing)
and is based on the [terraform-provider-scaffolding-framework](https://github.com/hashicorp/terraform-provider-scaffolding-framework)
repository.

To cut a new release:

1. Run `go generate .` inside of the `tools` directory to update the documentation.
2. Commit your changes.
3. Tag the commit with a semver tag (e.g., `v0.0.1`).
4. Push the changes `git push --atomic origin main <tag>`.