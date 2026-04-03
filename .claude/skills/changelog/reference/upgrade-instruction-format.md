[//]: # "Reference for the format and conventions of upgrade.mdx files."
[//]: # "Auto-loaded by the GenerateUpgradeInstructions workflow."

# Upgrade Instruction Format Reference

Upgrade instructions live in `upgrade.mdx` files inside each release directory under
`packages/website/src/content/changelog/`. They guide users through breaking changes
step-by-step. The unreleased file is at `main/upgrade.mdx`.

## File Structure

```
{/* Comment header describing the release and changes covered */}

## First Migration Step (prerequisite for others)

Instructions...

## Second Migration Step

Instructions...
```

## MDX Conventions

- Start with a `{/* comment */}` header — two lines: one identifying the release, one listing the changes covered
- Use `##` for section headings — do NOT use `#` (h1)
- Use backtick formatting for module names, commands, YAML keys, and file names
- Use markdown links `[text](url)` to link to relevant documentation at `/docs/edge/reference/...`
- Import and use `MarkdownAlert` from `@/components/markdown/MarkdownAlert.astro` for critical warnings (e.g., data-loss risks, known bugs, ordering gotchas)
- Keep prose concise and action-oriented

## Single-Command Principle

Each upgrade section should ideally reduce to a **single `pf` CLI command** the user can run to complete that migration step. The goal is `pf upgrade <step-name>` or similar — not a wall of manual shell commands.

### Decision process

1. **Check for an existing `pf` command** — Search the CLI source (`packages/cli/`) for a command that already handles this migration. If one exists, the section should just tell the user to run it.
2. **If no command exists** — Flag the breaking change as **needing a new CLI command**. Add a `todo` item to `review.yaml` stating: `"Breaking change '<summary>' requires a new pf CLI command to automate the migration."` Write the manual steps as a placeholder but mark the section with a `{/* TODO: Replace with pf CLI command once implemented */}` comment.
3. **Truly trivial steps are exempt** — If the migration is a single `terragrunt apply` or a one-line config edit, a dedicated CLI command is unnecessary. Use your judgment: if the step involves state manipulation, multi-file edits, or sequenced sub-commands, it should be a CLI command.

## Section Guidelines

| Guideline | Description |
|-----------|-------------|
| Granularity | One `##` section per breaking change, or group closely related changes into a single section |
| Heading style | Short imperative phrase (e.g., "Migrate `kube_cert_manager` to `kube_certificates`", "Update Provider Versions") |
| Single command | Prefer a single `pf` CLI command over multi-step manual instructions. Flag missing commands. |
| Fallback steps | When a CLI command doesn't exist yet, expand `action_items` into detailed numbered steps as a placeholder |
| Code blocks | Include HCL, bash, or YAML code blocks where migration commands or config changes are needed |
| Doc links | Link to relevant module reference docs using `/docs/edge/reference/...` paths |
| Cross-references | When a section depends on a prior section, state this explicitly (e.g., "After completing the DNS zone setup above, ...") |

## Examples

### Section with CLI command

```mdx
## Migrate `kube_cert_manager` to `kube_certificates`

`kube_cert_manager` and `kube_cert_issuers` have been consolidated into `kube_certificates`.

Run the following from your region directory:

```bash
pf migrate kube-certificates
```
```

### Section without CLI command (placeholder)

```mdx
{/* TODO: Replace with pf CLI command once implemented */}
## Rename Backup Vault in `tf_bootstrap_resources`

The backup vault name now includes a unique suffix. Before applying the updated module,
manually delete the existing vault.

1. Delete all recovery points in the `terraform-<env_name>` backup vault.
2. Delete the vault itself.
3. Re-apply `tf_bootstrap_resources`.
```

### Section with warning alert

```mdx
import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro"

<MarkdownAlert severity="warning">
  This step must be completed before re-enabling CI/CD deployments.
</MarkdownAlert>

## Update Provider Versions in First-Party IaC

All terraform provider versions have been upgraded. See the
[provider versions reference](/docs/edge/reference/infrastructure-modules/overview#provider-versions)
for the new values.
```

### Trivial section (no CLI command needed)

```mdx
## Review `burstable_nodes_enabled` Default

`burstable_nodes_enabled` now defaults to `true`. If you explicitly set it to `false`,
no action is needed. Otherwise, confirm your workloads are compatible with burstable
(T-family) instances.
```
