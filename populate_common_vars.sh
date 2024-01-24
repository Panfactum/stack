#!/bin/bash

# Directory containing the .tf files to be copied
source_directory=$TERRAFORM_COMMON_FILES_DIR

# Directory containing the directories to be searched
search_directory=$TERRAFORM_MODULES_DIR

# Destination parent directory
destination_parent_directory=$TERRAFORM_LIVE_DIR

optionalProviderConfig () {
    # Check if the terraform block contains required_providers with aws
    if echo "$json" | jq -e ".terraform.[0].required_providers.[0].$1" > /dev/null; then
        # Create destination directory with the same name as source directory
        destination_dir="${destination_parent_directory}/$(basename "$dir")"
        mkdir -p "$destination_dir"

        # Copy the .tf file to the destination directory
        cp "${source_directory}/$1.tf" "$destination_dir"
        echo "Copied $1.tf to $destination_dir" >&2
    fi
}

# Iterate over each subdirectory in the search directory
for dir in "$search_directory"/*; do
    if [[ -d "$dir" && -f "$dir/main.tf" ]]; then
        # Convert main.tf from HCL to JSON
        json=$(hcl2json "$dir/main.tf")

        # Copy common
        cp "${source_directory}/common_vars.tf" "$dir"
        echo "Copied common_vars.tf to $dir" >&2

        if grep -q '^// Live' "$dir/main.tf"; then
            # Create destination directory with the same name as source directory
            destination_dir="${destination_parent_directory}/$(basename "$dir")"
            mkdir -p "$destination_dir"

            # Copy all files from the current directory to the destination directory
            cp -r "$dir"/* "$destination_dir"
            optionalProviderConfig "aws"
            optionalProviderConfig "datadog"
            optionalProviderConfig "github"
            optionalProviderConfig "helm"
            optionalProviderConfig "kubernetes"
            optionalProviderConfig "local"
            optionalProviderConfig "okta"
            optionalProviderConfig "random"
            optionalProviderConfig "time"
            optionalProviderConfig "tls"
            optionalProviderConfig "vault"
            echo "Copied all files to $destination_dir" >&2
        else
            echo "The main.tf in $dir does not contain the '// Live' comment. Skipping copy of all files." >&2
        fi
    fi
done