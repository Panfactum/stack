# CreatePresentation Workflow

Create a new Reveal.js slideshow presentation in the Panfactum website's content collection.

## Prerequisites

Before proceeding, verify:
1. **Slug is provided** — The user must provide a presentation slug (kebab-case directory name, e.g. `kubernetes-intro`) as `$0`
2. **Slug is unique** — Run `scripts/list-presentations.sh` from the skill directory to confirm no presentation with that slug already exists

If the slug already exists, ask the user whether they want to choose a different slug or modify the existing presentation.

## Workflow Steps

These workflow steps MUST be followed exactly as written.

### 1. Determine the Presentation Topic

If the user provided a topic or outline in the remaining arguments, use that. Otherwise, **ask the user** what the presentation should cover, including:
- Target audience
- Key points to cover
- Approximate number of slides (default: 6–12)

### 2. Create the Presentation Directory

Create the directory at:

```
packages/website/src/content/presentations/<slug>/
```

### 3. Create an Images Subdirectory

If the presentation will include local images, create:

```
packages/website/src/content/presentations/<slug>/images/
```

### 4. Generate the Slide MDX Files

Create the slide files following the conventions in @./reference/slide-conventions.md. Ensure:

- File names use zero-padded numeric prefixes (e.g. `01-intro.mdx`, `02-problem.mdx`)
- The first slide (alphabetically first file) contains `title`, `description`, `date`, and `author` in frontmatter
- The last slide uses `slideLayout: "center"` as a closing slide
- Each slide has one main idea
- Speaker notes are added where additional context is helpful

### 5. Verify the Content

Run the following from `packages/website/` to verify the presentation builds correctly:

```bash
pnpm check
```

Fix any errors before reporting success.

## Guidelines

- **Keep slides focused.** One main idea per slide. Avoid walls of text.
- **Aim for 6–12 slides** for a typical presentation. Adjust based on content depth.
- **Use code blocks sparingly.** Show only the essential lines; don't paste entire files.
- **Use mermaid diagrams** to illustrate architecture, flows, and relationships.
- **Add speaker notes** to slides that need additional context or talking points.
- **Follow the slide conventions reference** for all frontmatter, layout, and content formatting rules.
