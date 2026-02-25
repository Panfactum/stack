# CLI Tools

Scripts available in the `scripts/` directory for the presentation skill. Run from the skill directory (`.claude/skills/presentation/`).

## list-presentations.sh

Lists all presentation slugs under the presentations content directory.

**Usage:**

```bash
./scripts/list-presentations.sh
```

**Output:** One slug per line.

## list-slides.sh

Lists all MDX slide files for a given presentation, sorted by filename.

**Usage:**

```bash
./scripts/list-slides.sh <presentation-slug>
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `presentation-slug` | Yes | The kebab-case slug of the presentation to inspect |

**Output:** Numbered list of slide filenames (e.g. `1. 01-intro.mdx`).
