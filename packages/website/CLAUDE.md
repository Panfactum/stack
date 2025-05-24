# CLAUDE.md - Website Package

This file provides guidance to Claude Code when working with the website package.

## Overview

The website package is the official Panfactum documentation and marketing website built with Astro, Solid.js, and Tailwind CSS. It serves as the primary resource hub for users learning and implementing the Panfactum infrastructure framework.

## Key Technologies

- **Astro 5.1.9**: Static site generator with MDX support
- **Solid.js**: Interactive components (search, calculators, modals)
- **Tailwind CSS**: Utility-first styling
- **TypeScript**: Type safety
- **Algolia**: Search functionality
- **Expressive Code**: Syntax highlighting
- **KaTeX**: Math rendering

## Commands

### Development
```bash
# Start development server (port 4321)
pnpm run dev

# Type checking
pnpm run check

# Linting
pnpm run lint        # Check for errors
pnpm run lint:fix    # Auto-fix errors

# Build for production
pnpm run build

# Preview production build
pnpm run preview

# Bundle analysis
pnpm run visualizer
```

## Project Structure

```
src/
├── components/         # Shared components
├── content/           # MDX content files
│   └── docs/         # Documentation pages
│       ├── concepts/
│       ├── guides/
│       ├── reference/
│       └── changelog/
├── layouts/           # Page layouts
├── lib/              # Utilities and plugins
├── pages/            # Route-based pages
│   ├── docs/         # Documentation viewer
│   ├── plus/         # Enterprise offering
│   └── _components/  # Page-specific components
└── styles/           # Global styles
```

## Content Management

### Documentation Structure
- **Concepts**: Technical explanations and architecture
- **Guides**: Step-by-step tutorials
- **Reference**: API docs for infrastructure modules
- **Changelog**: Release notes and updates

### Multi-Version Support
Documentation supports multiple versions:
- `edge`: Latest development
- `main`: Current stable
- `stable-25-04`: LTS releases

### MDX Features
- Frontmatter metadata
- Custom components (Alert, Badge, CodeBlock)
- Math equations with KaTeX
- Mermaid diagrams
- Auto-generated table of contents

## Key Features

### Search Integration
- Powered by Algolia
- Keyboard shortcuts (Cmd/Ctrl + K)
- Version-aware search results
- Highlighted matches

### Interactive Components
- **Pricing Calculator**: ROI estimator for Panfactum Plus
- **Version Selector**: Switch between doc versions
- **Code Groups**: Multi-language examples
- **Copy Code**: One-click code copying
- **FAQ Sections**: Animated accordions

### Performance Optimizations
- HTML/CSS/JS compression
- Critical CSS inlining
- Image optimization with Unpic
- Prefetch on hover
- Static site generation

## Development Workflow

### Adding Documentation
1. Create MDX file in appropriate content directory
2. Add frontmatter with title, description
3. Include in sidebar navigation config
4. Test local rendering and links

### Modifying Components
1. Components use Solid.js for interactivity
2. Follow existing patterns for state management
3. Use Tailwind classes for styling
4. Test responsive behavior

### Updating Styles
1. Global styles in `src/styles/`
2. Component styles use Tailwind utilities
3. Custom CSS variables for theming
4. Dark mode support throughout

## Environment Variables

```bash
# Algolia Search
PUBLIC_ALGOLIA_INDEX_NAME=panfactum
PUBLIC_ALGOLIA_APP_ID=xxx
PUBLIC_ALGOLIA_SEARCH_API_KEY=xxx

# PostHog Analytics
PUBLIC_POSTHOG_API_KEY=xxx
PUBLIC_POSTHOG_API_URL=https://us.i.posthog.com

# Build Configuration
ASTRO_TELEMETRY_DISABLED=1
```

## Deployment

### Build Process
1. `pnpm run build` generates static files in `dist/`
2. All routes pre-rendered at build time
3. Client-side JS only where needed
4. Outputs optimized for CDN hosting

### Container Support
```bash
# Build container
docker build -t panfactum-website .

# Run locally
docker run -p 8080:80 panfactum-website
```

## Testing

```bash
# Type checking
pnpm run check

# Link checking (manual)
# Start dev server then check for 404s

# Lighthouse performance
# Run against preview build

# Cross-browser testing
# Test on Chrome, Firefox, Safari, Edge
```

## Important Notes

- Keep documentation in sync with infrastructure modules
- Update version selectors when releasing
- Test search functionality after content changes
- Optimize images before committing
- Follow MDX best practices for content
- Maintain consistent navigation structure
- Test responsive design on mobile devices