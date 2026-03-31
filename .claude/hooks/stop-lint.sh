#!/usr/bin/env bash
# Stop hook: run heavier project-wide checks based on which files changed.
# Runs typecheck-website, typecheck-cli, and generate-tf-reference as needed.

set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Collect all changed files (staged, unstaged, and untracked) relative to repo root
CHANGED_FILES=$(
  {
    git diff --name-only HEAD 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | sort -u
)

if [[ -z "$CHANGED_FILES" ]]; then
  exit 0
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

HAS_WEBSITE=false
HAS_CLI=false
ESLINT_WEBSITE_FILES=()
ESLINT_CLI_FILES=()
SHFMT_FILES=()
NIXFMT_FILES=()
HCLFMT_FILES=()
TOFUFMT_FILES=()
TF_MODULES=()

while IFS= read -r file; do
  case "$file" in
  packages/website/*)
    HAS_WEBSITE=true
    if [[ "$file" =~ \.(ts|tsx|astro)$ && "$file" =~ ^packages/website/src/ ]]; then
      ESLINT_WEBSITE_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    ;;
  packages/cli/*)
    HAS_CLI=true
    if [[ "$file" =~ \.ts$ ]]; then
      ESLINT_CLI_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    if [[ "$file" =~ \.nix$ ]]; then
      NIXFMT_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    if [[ "$file" =~ \.hcl$ ]]; then
      HCLFMT_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    ;;
  packages/nix/*)
    if [[ "$file" =~ \.(sh|bash)$ ]]; then
      SHFMT_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    if [[ "$file" =~ \.nix$ ]]; then
      NIXFMT_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    ;;
  packages/installer/*)
    if [[ "$file" =~ \.(sh|bash)$ ]]; then
      SHFMT_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    ;;
  packages/infrastructure/*)
    if [[ "$file" =~ \.(sh|bash)$ ]]; then
      SHFMT_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    if [[ "$file" =~ \.tf$ ]]; then
      TOFUFMT_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    if [[ "$file" =~ ^packages/infrastructure/([^/]+)/ ]]; then
      module="${BASH_REMATCH[1]}"
      # Deduplicate
      found=false
      for existing in "${TF_MODULES[@]+"${TF_MODULES[@]}"}"; do
        if [[ "$existing" == "$module" ]]; then
          found=true
          break
        fi
      done
      if [[ "$found" == "false" ]]; then
        TF_MODULES+=("$module")
      fi
    fi
    ;;
  infrastructure/*)
    if [[ "$file" =~ \.tf$ ]]; then
      TOFUFMT_FILES+=("$CLAUDE_PROJECT_DIR/$file")
    fi
    ;;
  esac
done <<<"$CHANGED_FILES"

PIDS=()

if [[ "$HAS_WEBSITE" == "true" ]]; then
  (
    cd "$CLAUDE_PROJECT_DIR/packages/website"
    NODE_OPTIONS=--max-old-space-size=8192 pnpm check >"$TMPDIR/typecheck-website" 2>&1 || echo "typecheck-website" >>"$TMPDIR/failed"
  ) &
  PIDS+=($!)
fi

if [[ "$HAS_CLI" == "true" ]]; then
  (
    cd "$CLAUDE_PROJECT_DIR/packages/cli"
    NODE_OPTIONS=--max-old-space-size=8192 bun check >"$TMPDIR/typecheck-cli" 2>&1 || echo "typecheck-cli" >>"$TMPDIR/failed"
  ) &
  PIDS+=($!)
fi

if [[ ${#SHFMT_FILES[@]} -gt 0 ]]; then
  shfmt -w -i 2 "${SHFMT_FILES[@]}" 2>/dev/null &
  PIDS+=($!)
fi

if [[ ${#NIXFMT_FILES[@]} -gt 0 ]]; then
  nixfmt "${NIXFMT_FILES[@]}" 2>/dev/null &
  PIDS+=($!)
fi

if [[ ${#HCLFMT_FILES[@]} -gt 0 ]]; then
  for hcl_file in "${HCLFMT_FILES[@]}"; do
    terragrunt hclfmt --terragrunt-hclfmt-file "$hcl_file" 2>/dev/null &
    PIDS+=($!)
  done
fi

if [[ ${#TOFUFMT_FILES[@]} -gt 0 ]]; then
  for tf_file in "${TOFUFMT_FILES[@]}"; do
    tofu fmt "$tf_file" 2>/dev/null &
    PIDS+=($!)
  done
fi

if [[ ${#ESLINT_WEBSITE_FILES[@]} -gt 0 ]]; then
  (
    cd "$CLAUDE_PROJECT_DIR/packages/website"
    NODE_OPTIONS=--max-old-space-size=8192 LINT=true node_modules/.bin/eslint --fix "${ESLINT_WEBSITE_FILES[@]}" 2>/dev/null
  ) &
  PIDS+=($!)
fi

if [[ ${#ESLINT_CLI_FILES[@]} -gt 0 ]]; then
  (
    cd "$CLAUDE_PROJECT_DIR/packages/cli"
    NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/eslint --fix "${ESLINT_CLI_FILES[@]}" 2>/dev/null
  ) &
  PIDS+=($!)
fi

if [[ ${#TF_MODULES[@]} -gt 0 ]]; then
  (
    for module in "${TF_MODULES[@]}"; do
      generate-tf-reference "$module" >"$TMPDIR/tf-ref-$module" 2>&1 || echo "generate-tf-reference:$module" >>"$TMPDIR/failed"
    done
  ) &
  PIDS+=($!)
fi

for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
  wait "$pid" || true
done

if [[ ! -f "$TMPDIR/failed" ]]; then
  exit 0
fi

ERRORS=""
while IFS= read -r tool; do
  case "$tool" in
  typecheck-website)
    ERRORS+="typecheck-website: type errors found in packages/website"$'\n'
    ERRORS+="$(cat "$TMPDIR/typecheck-website")"$'\n'
    ;;
  typecheck-cli)
    ERRORS+="typecheck-cli: type errors found in packages/cli"$'\n'
    ERRORS+="$(cat "$TMPDIR/typecheck-cli")"$'\n'
    ;;
  generate-tf-reference:*)
    module="${tool#generate-tf-reference:}"
    ERRORS+="generate-tf-reference: failed for module $module"$'\n'
    ERRORS+="$(cat "$TMPDIR/tf-ref-$module")"$'\n'
    ;;
  esac
done <"$TMPDIR/failed"

echo "$ERRORS" >&2
exit 2
