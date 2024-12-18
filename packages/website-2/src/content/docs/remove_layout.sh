#!/bin/bash

# Directory containing Markdown files
MD_DIR="${1:-.}"

# Resolve the full path of the directory
MD_DIR=$(realpath "$MD_DIR")

# Check if the directory exists
if [[ ! -d "$MD_DIR" ]]; then
  echo "Error: Directory '$MD_DIR' does not exist."
  exit 1
fi

# Determine the correct `sed` command for the platform
if [[ "$(uname)" == "Darwin" ]]; then
  SED_CMD="sed -i ''"
else
  SED_CMD="sed -i"
fi

# Loop through all .md and .mdx files in the directory
find "$MD_DIR" -type f \( -name "*.md" -o -name "*.mdx" \) | while read -r file; do
  if [[ -f "$file" ]]; then
    # Remove the line containing `layout: ...` in the frontmatter
    $SED_CMD '/^layout: /d' "$file"
    echo "Processed: $file"
  else
    echo "Skipping: $file (not a regular file)"
  fi
done

echo "All Markdown files in '$MD_DIR' (.md and .mdx) have been processed."
