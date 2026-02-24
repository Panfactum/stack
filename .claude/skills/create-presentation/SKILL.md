---
name: create-presentation
description: Create a new Reveal.js presentation from a topic or outline. USE WHEN the user wants to create, draft, or write a new slideshow presentation.
argument-hint: <presentation-name> [topic or outline]
---

# Create Presentation

Create a new Reveal.js slideshow presentation in the Panfactum website's content collection.

## Arguments

- `$0` (required): The presentation slug (kebab-case directory name, e.g. `kubernetes-intro`)
- Remaining arguments: Topic description or outline for the presentation

## Process

1. **Determine the presentation topic.** If the user provided a topic or outline in the arguments, use that. Otherwise, ask the user what the presentation should cover.

2. **Create the presentation directory** at `packages/website/src/content/presentations/<slug>/`.

3. **Create an `images/` subdirectory** if the presentation will include local images.

4. **Generate the slide MDX files** following the conventions below.

5. **Verify the content** by running `pnpm check` from `packages/website/`.

## Presentation Structure

Each presentation is a directory of numbered MDX files under `packages/website/src/content/presentations/`. The directory name becomes the URL slug (e.g. `kubernetes-intro` serves at `/presentations/kubernetes-intro`).

### File Naming

Slide files use zero-padded numeric prefixes for ordering:

```
<slug>/
├── 01-intro.mdx
├── 02-problem.mdx
├── 03-solution.mdx
├── 04-details.mdx
├── 04a-diagram.mdx      ← Use letter suffixes to insert slides between existing ones
├── 05-demo.mdx
├── 06-closing.mdx
└── images/
    └── architecture.svg
```

Files are sorted alphanumerically by `a.id.localeCompare(b.id)`, so the numeric prefix determines slide order.

### Frontmatter Schema

Every MDX file has YAML frontmatter. All fields are optional except where noted:

```yaml
---
# FIRST SLIDE ONLY — these fields identify the presentation:
title: "Presentation Title"           # Displayed in the viewer toolbar and card
description: "Brief summary"          # Shown on the presentations index page
date: "2025-12-15"                    # ISO date, used for sorting on index page
author: "Author Name"                 # Shown on the presentation card

# ANY SLIDE:
slideLayout: "default"                # "default" | "center" | "two-column"
transition: "slide"                   # Reveal.js transition: "slide", "fade", "convex", "concave", "zoom"
notes: "Speaker notes go here..."     # Visible in Reveal.js speaker view (S key)
---
```

**Only the first slide** (alphabetically first file) should contain `title`, `description`, `date`, and `author`. These are extracted as presentation-level metadata.

### Slide Content

Slides use standard MDX. The following features are available:

#### Basic Markdown

```mdx
## Slide Heading

Body text with **bold**, *italic*, and `inline code`.

- Bullet point one
- Bullet point two
  - Nested bullet
```

#### Code Blocks

Use fenced code blocks with language identifiers. Syntax highlighting is handled by Reveal.js's highlight plugin.

```mdx
## Code Example

​```hcl
module "eks_cluster" {
  source = "github.com/Panfactum/stack//packages/infrastructure/kube_cluster"
  cluster_name = "production"
}
​```
```

#### Mermaid Diagrams

Mermaid code blocks are rendered to inline SVGs at build time (no browser required):

```mdx
## Architecture

​```mermaid
flowchart TD
    A[Developer] -->|git push| B[CI/CD]
    B -->|deploy| C[Kubernetes]
​```
```

#### Images

Import local images and use the `MarkdownImage` component:

```mdx
import MarkdownImage from "@/components/markdown/MarkdownImage.astro";
import architectureDiagram from './images/architecture.svg'

## System Architecture

<MarkdownImage src={architectureDiagram} alt="System architecture diagram" />
```

Store image files in an `images/` subdirectory within the presentation folder.

#### Centered Layout

Use `slideLayout: "center"` for title slides, section dividers, or closing slides:

```yaml
---
slideLayout: "center"
---
```

#### Speaker Notes

Add speaker notes via the `notes` frontmatter field. Presenters access them by pressing `S`:

```yaml
---
notes: "Key talking point: emphasize the cost savings. Mention the 40% reduction in infrastructure spend."
---
```

## Slide Design Guidelines

- **Keep slides focused.** One main idea per slide. Avoid walls of text.
- **Aim for 6-12 slides** for a typical presentation. Adjust based on content depth.
- **Use the first slide** as a title slide with `title`, `description`, `date`, and `author`.
- **Use the last slide** as a closing/thank-you slide with `slideLayout: "center"`.
- **Use `slideLayout: "center"`** for section dividers and emphasis slides.
- **Use code blocks sparingly.** Show only the essential lines; don't paste entire files.
- **Use mermaid diagrams** to illustrate architecture, flows, and relationships.
- **Add speaker notes** to slides that need additional context or talking points.
- **Use horizontal rules (`---`)** within a slide for visual separation, not to create new slides (each file is one slide).

## Example: Complete First Slide

```mdx
---
title: "Introduction to Panfactum"
description: "A walkthrough of the Panfactum Framework's core features"
date: "2025-12-15"
author: "Panfactum Team"
---

# Introduction to Panfactum

An integrated framework for building, deploying, and managing software on AWS and Kubernetes.

---

**The Panfactum Framework**
```

## Example: Content Slide with Notes

```mdx
---
notes: "Emphasize reproducibility. Mention that all dependencies are version-locked."
slideLayout: "default"
---

## Development Environment

Panfactum provides a Nix-based development shell that ensures every team member has:

- **Identical tooling** across the entire organization
- **Version-locked dependencies** for reproducibility
- **Zero configuration** - just run `pf-dev-start`
```
