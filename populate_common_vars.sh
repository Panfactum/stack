#!/bin/bash

# Directory containing the aws.tf file to be copied
source_directory=$TERRAFORM_COMMON_FILES_DIR

# Directory containing the directories to be searched
search_directory=$TERRAFORM_MODULES_DIR

# Iterate over each subdirectory in the search directory
for dir in "$search_directory"/*; do
    if [[ -d "$dir" && -f "$dir/main.tf" ]]; then
        # Convert main.tf from HCL to JSON
        json=$(hcl2json "$dir/main.tf")

        # Copy common
        cp "${source_directory}/common_vars.tf" "$dir"
        echo "Copied common_vars.tf to $dir" >&2

        # Check if the terraform block contains required_providers with aws
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].aws' > /dev/null; then
            # Copy the aws.tf file to the current directory
            cp "${source_directory}/aws.tf" "$dir"
            echo "Copied aws.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with datadog
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].datadog' > /dev/null; then
            # Copy the datadog.tf file to the current directory
            cp "${source_directory}/datadog.tf" "$dir"
            echo "Copied datadog.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with github
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].github' > /dev/null; then
            # Copy the github.tf file to the current directory
            cp "${source_directory}/github.tf" "$dir"
            echo "Copied github.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with helm
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].helm' > /dev/null; then
            # Copy the helm.tf file to the current directory
            cp "${source_directory}/helm.tf" "$dir"
            echo "Copied helm.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with kubernetes
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].kubernetes' > /dev/null; then
            # Copy the kubernetes.tf file to the current directory
            cp "${source_directory}/kubernetes.tf" "$dir"
            echo "Copied kubernetes.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with local
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].local' > /dev/null; then
            # Copy the local.tf file to the current directory
            cp "${source_directory}/local.tf" "$dir"
            echo "Copied local.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with okta
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].okta' > /dev/null; then
            # Copy the okta.tf file to the current directory
            cp "${source_directory}/okta.tf" "$dir"
            echo "Copied okta.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with random
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].random' > /dev/null; then
            # Copy the random.tf file to the current directory
            cp "${source_directory}/random.tf" "$dir"
            echo "Copied random.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with time
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].time' > /dev/null; then
            # Copy the time.tf file to the current directory
            cp "${source_directory}/time.tf" "$dir"
            echo "Copied time.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with tls
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].tls' > /dev/null; then
            # Copy the tls.tf file to the current directory
            cp "${source_directory}/tls.tf" "$dir"
            echo "Copied tls.tf to $dir" >&2
        fi

        # Check if the terraform block contains required_providers with vault
        if echo "$json" | jq -e '.terraform.[0].required_providers.[0].vault' > /dev/null; then
            # Copy the vault.tf file to the current directory
            cp "${source_directory}/vault.tf" "$dir"
            echo "Copied vault.tf to $dir" >&2
        fi
    fi
done