---
name: presentation
description: Manage Reveal.js presentations — create new presentations, list existing ones, or list slides within a presentation. USE WHEN the user wants to create, list, or inspect slideshow presentations.
argument-hint: <presentation-name> [topic or outline]
---

# Presentation

Manage Reveal.js slideshow presentations in the Panfactum website's content collection.

## When Invoked

1. **Read references**: Load the slide conventions: @./reference/slide-conventions.md

2. **Gather context**: Run `list-presentations.sh` from the `scripts/` directory to see existing presentations.

3. **Determine intent**: Analyze the user's request against trigger words in the Workflow Routing table below.

4. **Select workflow**: Choose the appropriate action:
   1. Does the user want to create a new presentation? → **CreatePresentation**
   2. Does the user want to add a slide to an existing presentation? → **AddSlide**
   3. Does the user want to list presentations? → Run `scripts/list-presentations.sh` directly
   4. Does the user want to list slides in a presentation? → Run `scripts/list-slides.sh <slug>` directly
   5. When in doubt: Ask the user which action they want

5. **Execute workflow**: Report "Running <workflow-name> using the presentation skill..." Read and follow the selected workflow completely.

6. **Report results**: Summarize what was accomplished and suggest next steps.

## Workflow Routing

| Workflow | Trigger Words | When to Use |
|----------|---------------|-------------|
| [CreatePresentation](./workflows/CreatePresentation.md) | "create", "new", "build", "make", "add presentation" | User wants to create a new Reveal.js presentation from scratch |
| [AddSlide](./workflows/AddSlide.md) | "add slide", "insert slide", "new slide", "append slide" | User wants to add a slide to an existing presentation |

## Reference

- [Slide Conventions](./reference/slide-conventions.md) — Presentation structure, frontmatter schema, content features, and design guidelines
- [CLI Tools](./reference/cli-tools.md) — Available CLI scripts for listing presentations and slides
