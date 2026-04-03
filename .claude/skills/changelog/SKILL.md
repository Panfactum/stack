---
name: changelog
description: Manage changelog entries — add, edit, validate, or summarize changes in main/log.yaml. USE WHEN the user wants to manage changelog entries, add release notes, or validate changelog data.
argument-hint: "[action] [description]"
---

# Changelog

Manage structured changelog entries for the Panfactum stack's main (unreleased) channel.

## When Invoked

1. **Read references**: Load the changelog format conventions: @./reference/changelog-format.md

2. **Gather context**: Run `./scripts/list-changes.ts` to see current entries in `main/log.yaml`.

3. **Determine intent**: Analyze the user's request against trigger words in the Workflow Routing table below.

4. **Select workflow**: Choose the appropriate action:
   1. Does the user want to add or edit changelog entries? → **UpdateEntry**
   2. Does the user want to validate the changelog? → **ValidateChangelog**
   3. Does the user want to generate a release summary? → **GenerateSummary**
   4. Does the user want to generate upgrade instructions? → **GenerateUpgradeInstructions**
   5. Does the user want to list current changes? → Run `./scripts/list-changes.ts` directly
   6. When in doubt: Ask the user which action they want

5. **Execute workflow**: Report "Running <workflow-name> using the changelog skill..." Read and follow the selected workflow completely.

6. **Report results**: Summarize what was accomplished and suggest next steps.

## Workflow Routing

| Workflow | Trigger Words | When to Use |
|----------|---------------|-------------|
| [UpdateEntry](./workflows/UpdateEntry.md) | "add", "new", "log", "record", "entry", "edit", "update", "modify", "reorganize", "fix" | Developer wants to add or edit change entries |
| [ValidateChangelog](./workflows/ValidateChangelog.md) | "validate", "check", "verify", "review" | Developer wants to check changelog completeness and correctness |
| [GenerateSummary](./workflows/GenerateSummary.md) | "summarize", "summary", "highlights", "release", "compile" | Preparing a release — generate summary and highlights from changes |
| [GenerateUpgradeInstructions](./workflows/GenerateUpgradeInstructions.md) | "upgrade", "instructions", "migration" | Developer wants to generate or update upgrade instructions from breaking changes |

## Reference

- [Changelog Format](./reference/changelog-format.md) — log.yaml schema reference, valid enums, structure, and examples
- [Upgrade Instruction Format](./reference/upgrade-instruction-format.md) — upgrade.mdx conventions, single-command principle, section guidelines, and examples
- [CLI Tools](./reference/cli-tools.md) — Available CLI scripts for listing changes and components
