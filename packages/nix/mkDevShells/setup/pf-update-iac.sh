#!/usr/bin/env bash

set -eo pipefail

# Purpose: Utility to update first-party iac modules. This accomplishes the following tasks:
#  - Applies the template snippets
#  - Updates module refs

REPO_VARIABLES=$(pf-get-repo-variables)
IAC_DIR=$(echo "$REPO_VARIABLES" | jq -r '.iac_dir')
REPO_ROOT=$(echo "$REPO_VARIABLES" | jq -r '.repo_root')

###########################################################
# Step 1: Perform replacements
###########################################################

# New content to replace between the markers
SOURCE_DIR=$(dirname "$(dirname "$(realpath "$0")")")/files/iac
SET_VARS_SNIPPET=$(cat "$SOURCE_DIR/set_vars.txt")
SET_VARS_NO_EXTRA_TAGS_SNIPPET=$(cat "$SOURCE_DIR/set_vars_no_extra_tags.txt")
SET_VARS_NO_REGION_SNIPPET=$(cat "$SOURCE_DIR/set_vars_no_region.txt")
PASS_VARS_SNIPPET=$(cat "$SOURCE_DIR/pass_vars.txt")
PASS_VARS_NO_EXTRA_TAGS_SNIPPET=$(cat "$SOURCE_DIR/pass_vars_no_extra_tags.txt")
STANDARD_VARS_SNIPPET=$(cat "$SOURCE_DIR/standard_vars.tf")

START_MARKER="^[[:space:]]*#[[:space:]]*pf-generate:[[:space:]]*"
END_MARKER="^[[:space:]]*#[[:space:]]*end-generate"

function generate_template() {
  awk -v start="$1" -v end="$END_MARKER" -v replacement="$2" '
    $0 ~ start {print; p=1; print replacement; next}
    $0 ~ end {p=0}
    !p
  ' "$3" >/tmp/temp.tf && mv /tmp/temp.tf "$3"
}

# First attempt to source it from the flake;
# If that fails, ask the user to select a version
# from the available git tags
__PANFACTUM_VERSION_REF=
REPO="https://github.com/panfactum/stack.git"
function get_panfactum_version() {
  set +eo pipefail
  if [[ -z $__PANFACTUM_VERSION_REF ]]; then
    __PANFACTUM_VERSION_REF=$(jq -r '.nodes.panfactum.locked.rev' "$REPO_ROOT/flake.lock")
    if [[ $__PANFACTUM_VERSION_REF == "null" ]]; then
      local AVAILABLE_TAGS
      local GIT_REF
      AVAILABLE_TAGS=$(git ls-remote --tags "$REPO" | awk '{print $2}' | sed 's|refs/tags/||')
      GIT_REF=$(echo -e "$AVAILABLE_TAGS\nmain" | fzf --prompt="Select a module version: ")
      __PANFACTUM_VERSION_REF=$(git ls-remote "$REPO" "$GIT_REF" | awk '{print $1}')
    fi
  fi
  set -eo pipefail
}

function update_refs() {
  if [[ $PF_USE_LOCAL_SUBMODULES == 1 ]] && [[ -n $PF_LOCAL_SUBMODULE_PATH ]]; then
    local PATTERN
    PATTERN='github\.com/Panfactum/stack\.git//packages/infrastructure/([^?]+)\?ref=[a-zA-Z0-9]+'
    sed -E "s|$PATTERN|$PF_LOCAL_SUBMODULE_PATH//\1|g" "$1" >/tmp/temp.tf && mv /tmp/temp.tf "$1"
  elif [[ $PF_USE_LOCAL_SUBMODULES != 1 ]]; then
    awk '{
      if ($0 ~ /^[[:space:]]*source/ && ($0 ~ /#[[:space:]]*pf-update[[:space:]]*$/)) {
        gsub(/\?ref=[^"]*/, "?ref='"$__PANFACTUM_VERSION_REF"'");
        print $0
      } else {
        print $0
      }
    }' "$1" >/tmp/temp.tf && mv /tmp/temp.tf "$1"
    if [[ -n $PF_LOCAL_SUBMODULE_PATH ]]; then
      local PATTERN
      PATTERN="\"${PF_LOCAL_SUBMODULE_PATH//./\\.}//([^\"]+)\""
      sed -E "s|$PATTERN|\"github.com/Panfactum/stack.git//packages/infrastructure/\1?ref=$__PANFACTUM_VERSION_REF\"|g" "$1" >/tmp/temp.tf && mv /tmp/temp.tf "$1"
    fi
  fi
}

if [[ $PF_SKIP_IAC_REF_UPDATE != 1 && $PF_USE_LOCAL_SUBMODULES != 1 ]]; then
  get_panfactum_version
fi

for MODULE_DIR in "$IAC_DIR"/*; do
  if [[ -d $MODULE_DIR ]]; then
    MODULE_NAME="$(basename "$MODULE_DIR")"
    for FILE_PATH in "$MODULE_DIR"/*; do

      if [[ -f $FILE_PATH ]] && [[ ${FILE_PATH##*.} == "tf" || ${FILE_PATH##*.} == "hcl" ]]; then
        generate_template "${START_MARKER}set_vars[[:space:]]*$" "$SET_VARS_SNIPPET" "$FILE_PATH"
        generate_template "${START_MARKER}set_vars_no_extra_tags[[:space:]]*$" "$SET_VARS_NO_EXTRA_TAGS_SNIPPET" "$FILE_PATH"
        generate_template "${START_MARKER}set_vars_no_region[[:space:]]*$" "$SET_VARS_NO_REGION_SNIPPET" "$FILE_PATH"
        generate_template "${START_MARKER}pass_vars[[:space:]]*$" "$PASS_VARS_SNIPPET" "$FILE_PATH"
        generate_template "${START_MARKER}pass_vars_no_extra_tags[[:space:]]*$" "$PASS_VARS_NO_EXTRA_TAGS_SNIPPET" "$FILE_PATH"
        generate_template "${START_MARKER}standard_vars[[:space:]]*$" "${STANDARD_VARS_SNIPPET//__module_name__/${MODULE_NAME}}" "$FILE_PATH"

        if [[ $PF_SKIP_IAC_REF_UPDATE != 1 ]]; then
          update_refs "$FILE_PATH"
        fi
      fi
    done
  fi
done
