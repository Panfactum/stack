#!/bin/bash

# Loop through all .mdx files in the current directory and subdirectories
find . -type f -name "*.mdx" | while read -r file; do
    modified=false

    # Check for .svg imports without ?raw and update them
    if grep -qE 'import .* from .*\.(svg)["'\''\)]' "$file"; then
        # Replace `.svg` imports without `?raw` with `.svg?raw`
        sed -i -E 's/(import [^;]*\.svg)(["'\''\)])/\1?raw\2/g' "$file"
        echo "Updated SVG imports in $file to include ?raw"
        modified=true
    fi

    if [ "$modified" = true ]; then
        echo "Updated $file"
    else
        echo "No changes needed in $file"
    fi
done