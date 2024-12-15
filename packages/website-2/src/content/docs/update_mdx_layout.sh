#!/bin/bash

# Define the layout path to add
LAYOUT_PATH="@/layouts/DocumentationLayout.astro"

# Loop through all .mdx files in the current directory and subdirectories
find . -type f -name "*.mdx" | while read -r file; do
    # Check if the file contains an Astro layout definition
    if ! grep -q "^layout:" "$file"; then
        # Extract the title from the first Markdown heading (# Heading)
        TITLE=$(grep -m 1 "^# " "$file" | sed 's/^# //')

        # Default title if no heading is found
        if [ -z "$TITLE" ]; then
            TITLE="Untitled"
        fi

        # Create the layout section to add
        LAYOUT_SECTION="---
layout: \"$LAYOUT_PATH\"
title: \"$TITLE\"
---"

        # Prepend the layout section to the file
        echo -e "$LAYOUT_SECTION\n\n$(cat "$file")" > "$file"

        # Output the change
        echo "Updated $file with layout and title: \"$TITLE\""
    else
        echo "Skipped $file (layout already defined)"
    fi
done
