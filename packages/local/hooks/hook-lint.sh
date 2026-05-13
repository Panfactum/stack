#!@bash@
# PostToolUse hook: run linters on edited files.
# Dispatches linters based on file extension and path, running applicable tools in parallel.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | @jq@ -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  exit 0
fi

# Only lint files inside the project directory
if [[ "$FILE_PATH" != "$CLAUDE_PROJECT_DIR"/* ]]; then
  exit 0
fi

# Convert to relative path from project root for path-based matching
REL_PATH="${FILE_PATH#"$CLAUDE_PROJECT_DIR"/}"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

case "$FILE_PATH" in
*.md | *.mdx)
  { @cspell@ lint --no-progress --gitignore "$FILE_PATH" >"$TMPDIR/cspell" 2>&1 || echo "cspell" >>"$TMPDIR/failed"; } &
  ;;
*.sh | *.bash)
  if [[ "$REL_PATH" =~ ^packages/(nix|installer|infrastructure)/ ]]; then
    { @shellcheck@ "$FILE_PATH" >"$TMPDIR/shellcheck" 2>&1 || echo "shellcheck" >>"$TMPDIR/failed"; } &
  fi
  ;;
*.yaml)
  if [[ "$REL_PATH" =~ ^packages/website/src/content/changelog/.*log\.yaml$ ]]; then
    { @validateChangelog@ "$FILE_PATH" >"$TMPDIR/changelog-validate" 2>&1 || echo "changelog-validate" >>"$TMPDIR/failed"; } &
  elif [[ "$REL_PATH" =~ ^packages/website/src/content/changelog/.*review\.yaml$ ]]; then
    { @validateChangelogReview@ "$FILE_PATH" >"$TMPDIR/changelog-validate" 2>&1 || echo "changelog-validate" >>"$TMPDIR/failed"; } &
  elif [[ "$REL_PATH" =~ ^packages/website/src/content/docs/.*/reference/glossary/_terms/.*\.yaml$ ]]; then
    { @validateGlossary@ "$FILE_PATH" >"$TMPDIR/glossary-validate" 2>&1 || echo "glossary-validate" >>"$TMPDIR/failed"; } &
  elif [[ "$REL_PATH" == "packages/infrastructure/metadata.yaml" ]]; then
    { @validateIacMetadata@ "$FILE_PATH" >"$TMPDIR/changelog-validate" 2>&1 || echo "changelog-validate" >>"$TMPDIR/failed"; } &
  fi
  ;;
esac

# Path-based checks (not extension-based)
if [[ "$(basename "$REL_PATH")" == "package.json" ]]; then
  { @checkPackageJson@ >"$TMPDIR/package-json" 2>&1 || echo "package-json" >>"$TMPDIR/failed"; } &
fi

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
  changelog-validate)
    ERRORS+="changelog-validate: validation errors found in $FILE_PATH"$'\n'
    ERRORS+="$(cat "$TMPDIR/changelog-validate")"$'\n'
    ;;
  glossary-validate)
    ERRORS+="glossary-validate: validation errors found in $FILE_PATH"$'\n'
    ERRORS+="$(cat "$TMPDIR/glossary-validate")"$'\n'
    ;;
  package-json)
    ERRORS+="$(cat "$TMPDIR/package-json")"$'\n'
    ;;
  esac
done <"$TMPDIR/failed"

echo "$ERRORS" >&2
exit 2
