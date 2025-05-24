# CLAUDE.md - Scraper Package

This file provides guidance to Claude Code when working with the scraper package.

## Overview

The scraper package is a specialized web scraping tool that crawls the Panfactum documentation website and populates an Algolia search index. It extracts structured content from HTML pages, creating searchable sections with hierarchical relationships and relevance scoring.

## Key Files

### Source Files
- **main.ts**: Entry point that orchestrates the scraping pipeline
- **extractUrlsFromSitemap.ts**: Parses XML sitemaps to extract URLs
- **scrapeUrls.ts**: Fetches HTML content with retry logic and caching
- **createParsedHtmlSections.ts**: Parses HTML into structured sections
- **updateAlgoliaIndex.ts**: Manages Algolia index updates
- **algolia.client.ts**: Algolia client configuration
- **const.ts**: Constants and configuration values

### Configuration
- **package.json**: Dependencies and scripts
- **tsconfig.json**: TypeScript configuration
- **Containerfile**: Docker image for production deployment

## Commands

### Development
```bash
# Run the scraper locally
pnpm run dev

# Run with custom arguments
npx tsx src/main.ts <sitemap-url> <algolia-index-name>

# Build for production
pnpm run build
```

### Production
```bash
# Build container image
docker build -t panfactum-scraper .

# Run container
docker run -e ALGOLIA_APP_ID=xxx -e ALGOLIA_API_KEY=xxx panfactum-scraper
```

## Architecture

### Scraping Pipeline
1. **URL Extraction**: Parses sitemap.xml files (handles nested indexes)
2. **Content Fetching**: Downloads HTML with retry logic (3 attempts)
3. **Caching**: Stores scraped content in tmp/ for development
4. **Parsing**: Extracts sections based on heading hierarchy
5. **Indexing**: Uploads to Algolia in batches

### Content Parsing Logic
- Creates sections based on heading tags (h1-h6)
- Each section includes:
  - Hierarchical headings (h1, h2, h3, etc.)
  - Content between headings
  - Breadcrumb navigation
  - URL and anchor links
  - Weight score for relevance

### Special Handling
- Filters out changelog pages
- Focuses on /docs/ content
- Removes navigation elements
- Handles footnotes, tables, alerts
- Preserves code blocks and lists

## Environment Variables

**Required for Algolia:**
- `ALGOLIA_APP_ID`: Application ID
- `ALGOLIA_API_KEY`: Write-enabled API key

**Optional:**
- `ALGOLIA_INDEX_NAME`: Override default index
- `TMP_DIR`: Cache directory (default: ./tmp)

## Development Workflow

1. Set environment variables
2. Run `pnpm run dev` to scrape with caching
3. Check tmp/scraped.json for raw content
4. Check tmp/sections.json for parsed sections
5. Verify Algolia index updates

## Testing

```bash
# Test URL extraction
npx tsx src/extractUrlsFromSitemap.ts https://panfactum.com/sitemap.xml

# Test single page parsing
npx tsx src/main.ts https://panfactum.com/docs https://panfactum.com/docs/getting-started test-index

# Dry run without Algolia
# Comment out updateAlgoliaIndex call in main.ts
```

## Production Deployment

The scraper runs as a containerized job, typically triggered:
- After documentation updates
- On a schedule for freshness
- Manually for debugging

Container includes all dependencies bundled via @vercel/ncc.

## Important Notes

- Always clear the index before updating to avoid stale content
- Caching is only for development - production always fetches fresh
- Rate limiting: Uses retry-axios with exponential backoff
- Memory usage: Processes URLs sequentially to avoid OOM
- Error handling: Continues on individual page failures