#!/usr/bin/env bash
# PostToolUse hook: run linters on edited files.
# Dispatches linters based on file extension and path, running applicable tools in parallel.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  exit 0
fi

# Convert to relative path from project root for path-based matching
REL_PATH="${FILE_PATH#"$CLAUDE_PROJECT_DIR"/}"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

case "$FILE_PATH" in
  *.md | *.mdx)
    { cspell lint --no-progress --gitignore "$FILE_PATH" >"$TMPDIR/cspell" 2>&1 || echo "cspell" >>"$TMPDIR/failed"; } &
    ;;
  *.sh | *.bash)
    if [[ "$REL_PATH" =~ ^packages/(nix|installer|infrastructure)/ ]]; then
      { shellcheck "$FILE_PATH" >"$TMPDIR/shellcheck" 2>&1 || echo "shellcheck" >>"$TMPDIR/failed"; } &
      { shfmt --diff -i 2 "$FILE_PATH" >"$TMPDIR/shfmt" 2>&1 || echo "shfmt" >>"$TMPDIR/failed"; } &
    fi
    ;;
  *.nix)
    if [[ "$REL_PATH" =~ ^packages/(nix|cli)/ ]]; then
      { nixfmt -c "$FILE_PATH" >"$TMPDIR/nixfmt" 2>&1 || echo "nixfmt" >>"$TMPDIR/failed"; } &
    fi
    ;;
  *.hcl)
    if [[ "$REL_PATH" =~ ^packages/cli/ ]]; then
      { terragrunt hclfmt --terragrunt-check --terragrunt-diff --terragrunt-hclfmt-file "$FILE_PATH" >"$TMPDIR/hclfmt" 2>&1 || echo "hclfmt" >>"$TMPDIR/failed"; } &
    fi
    ;;
  *.tf)
    if [[ "$REL_PATH" =~ ^packages/infrastructure/ ]]; then
      { tofu fmt -diff -check "$FILE_PATH" >"$TMPDIR/tofufmt" 2>&1 || echo "tofufmt" >>"$TMPDIR/failed"; } &
    fi
    ;;
  *.ts)
    if [[ "$REL_PATH" =~ ^packages/website/src/ ]]; then
      { (cd "$CLAUDE_PROJECT_DIR/packages/website" && NODE_OPTIONS=--max-old-space-size=8192 LINT=true node_modules/.bin/eslint "$FILE_PATH") >"$TMPDIR/eslint-website" 2>&1 || echo "eslint-website" >>"$TMPDIR/failed"; } &
    elif [[ "$REL_PATH" =~ ^packages/cli/ ]]; then
      { (cd "$CLAUDE_PROJECT_DIR/packages/cli" && NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/eslint "$FILE_PATH") >"$TMPDIR/eslint-cli" 2>&1 || echo "eslint-cli" >>"$TMPDIR/failed"; } &
    fi
    ;;
  *.tsx | *.astro)
    if [[ "$REL_PATH" =~ ^packages/website/src/ ]]; then
      { (cd "$CLAUDE_PROJECT_DIR/packages/website" && NODE_OPTIONS=--max-old-space-size=8192 LINT=true node_modules/.bin/eslint "$FILE_PATH") >"$TMPDIR/eslint-website" 2>&1 || echo "eslint-website" >>"$TMPDIR/failed"; } &
    fi
    ;;
esac

wait

if [[ ! -f "$TMPDIR/failed" ]]; then
  exit 0
fi

ERRORS=""
while read -r tool; do
  case "$tool" in
    cspell)
      ERRORS+="cspell: spelling errors found in $FILE_PATH"$'\n'
      ERRORS+="$(cat "$TMPDIR/cspell")"$'\n'
      ;;
    shellcheck)
      ERRORS+="$(cat "$TMPDIR/shellcheck")"$'\n'
      ;;
    shfmt)
      shfmt -w -i 2 "$FILE_PATH" 2>/dev/null
      ERRORS+="shfmt: file was not formatted correctly and has been auto-formatted: $FILE_PATH"$'\n'
      ;;
    nixfmt)
      nixfmt "$FILE_PATH" 2>/dev/null
      ERRORS+="nixfmt: file was not formatted correctly and has been auto-formatted: $FILE_PATH"$'\n'
      ;;
    hclfmt)
      terragrunt hclfmt --terragrunt-hclfmt-file "$FILE_PATH" 2>/dev/null
      ERRORS+="hclfmt: file was not formatted correctly and has been auto-formatted: $FILE_PATH"$'\n'
      ;;
    tofufmt)
      tofu fmt "$FILE_PATH" 2>/dev/null
      ERRORS+="tofu fmt: file was not formatted correctly and has been auto-formatted: $FILE_PATH"$'\n'
      ;;
    eslint-website)
      ERRORS+="eslint (website): linting errors found in $FILE_PATH"$'\n'
      ERRORS+="$(cat "$TMPDIR/eslint-website")"$'\n'
      ;;
    eslint-cli)
      ERRORS+="eslint (cli): linting errors found in $FILE_PATH"$'\n'
      ERRORS+="$(cat "$TMPDIR/eslint-cli")"$'\n'
      ;;
  esac
done <"$TMPDIR/failed"

echo "$ERRORS" >&2
exit 2
