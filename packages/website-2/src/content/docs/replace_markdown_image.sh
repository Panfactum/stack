#!/bin/bash

# Loop through all .mdx files in the current directory and subdirectories
find . -type f -name "*.mdx" | while read -r file; do
    modified=false

    # Check if the file contains MarkdownImage
    if grep -q '<MarkdownImage' "$file"; then
        # Check if the file contains Astro frontmatter (triple dashes)
        if grep -q "^---" "$file"; then
            # Add the import statement after the Astro section if not already present
            if ! grep -q 'import { Image } from "astro:assets";' "$file"; then
                # Find the line number of the closing triple dashes
                line=$(grep -n "^---" "$file" | tail -n 1 | cut -d: -f1)
                # Insert the import statement after the triple dashes
                sed -i "$((line+1))i import { Image } from \"astro:assets\";" "$file"
                echo "Added Image import to $file after Astro section"
                modified=true
            fi
        else
            # Add the import statement at the top if no Astro section is found
            if ! grep -q 'import { Image } from "astro:assets";' "$file"; then
                sed -i '1i import { Image } from "astro:assets";' "$file"
                echo "Added Image import to the top of $file (no Astro section)"
                modified=true
            fi
        fi

        # Replace MarkdownImage with Image while preserving src and alt
        sed -i 's/<MarkdownImage\s\+src={\([^}]*\)}\s\+alt="\([^"]*\)"\s*\/>/\n<Image src={\1} alt="\2" \/>/g' "$file"
        echo "Replaced MarkdownImage with Image in $file"
        modified=true
    fi

    if [ "$modified" = true ]; then
        echo "Updated $file"
    else
        echo "No changes needed in $file"
    fi
done
