#!/usr/bin/env bash

# Loop through all directories and subdirectories
find . -type f -name "page.mdx" | while read -r file; do
    # Get the directory of the file
    dir=$(dirname "$file")

    # Rename page.mdx to index.mdx
    mv "$file" "$dir/index.mdx"

    # Output the action
    echo "Renamed $file to $dir/index.mdx"
done
