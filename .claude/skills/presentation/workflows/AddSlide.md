# AddSlide Workflow

Add a new slide to an existing Reveal.js presentation.

## Prerequisites

Before proceeding, verify:
1. **Presentation exists** — Run `scripts/list-presentations.sh` from the skill directory and confirm the target presentation slug exists
2. **Slide content is known** — The user must describe what the new slide should contain, or provide enough context to determine it

If the presentation does not exist, switch to the CreatePresentation workflow instead.

## Workflow Steps

These workflow steps MUST be followed exactly as written.

### 1. Identify the Target Presentation

If the user provided a presentation slug, use that. Otherwise, run `scripts/list-presentations.sh` and **ask the user** which presentation to add a slide to.

### 2. Review Existing Slides

Run `scripts/list-slides.sh <slug>` to get the current slide list. Read each slide file to understand the presentation's flow and content so the new slide fits naturally.

### 3. Determine Slide Placement

**Ask the user** where the new slide should go if not already specified. Use the existing slide list as context:

| Situation | Naming Strategy |
|-----------|-----------------|
| Append at the end (before closing slide) | Use the next available numeric prefix (e.g. if last content slide is `05-demo.mdx`, use `06-newslide.mdx` and renumber the closing slide) |
| Insert between two existing slides | Use a letter suffix on the preceding slide's number (e.g. between `03-solution.mdx` and `04-details.mdx`, use `03a-newslide.mdx`) |
| Insert between existing letter-suffixed slides | Use the next letter (e.g. between `04a-diagram.mdx` and `04b-chart.mdx`, use `04ab-newslide.mdx` — or renumber if it gets unwieldy) |
| Replace the closing slide position | Renumber the closing slide to make room |

If inserting before the closing slide, renumber the closing slide's prefix so it remains last. **Present the planned filename to the user for confirmation** before creating the file.

### 4. Determine Slide Content

If the user provided the content or a clear description, use that. Otherwise, **ask the user** for:
- The main idea or heading for the slide
- Key points or content to include
- Whether it needs a special layout (`center`, `two-column`)
- Whether to include code blocks, diagrams, or images
- Any speaker notes

### 5. Create the Slide File

Create the MDX file at:

```
packages/website/src/content/presentations/<slug>/<filename>.mdx
```

Follow the conventions in @./reference/slide-conventions.md. Ensure:
- The frontmatter includes appropriate fields (`slideLayout`, `notes`, `transition` as needed)
- Do NOT include `title`, `description`, `date`, or `author` — those belong only on the first slide
- The content follows the one-idea-per-slide principle

### 6. Verify the Content

Run the following from `packages/website/` to verify the presentation builds correctly:

```bash
pnpm check
```

Fix any errors before reporting success.

## Guidelines

- **Preserve the existing narrative flow.** Read surrounding slides to ensure the new slide transitions naturally.
- **Keep slides focused.** One main idea per slide. If the content is too dense, suggest splitting into multiple slides.
- **Match the existing style.** Use the same heading levels, formatting patterns, and tone as the other slides in the presentation.
- **Renumber conservatively.** Prefer letter suffixes over renumbering the entire presentation to minimize diff noise.
- **Follow the slide conventions reference** for all frontmatter, layout, and content formatting rules.
