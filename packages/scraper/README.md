# Overview

This package is a web scraper that can be used to scrape data from the web for the purposes of panfactum.com. 
Currently it's main purpose is to scrape panfactum.com and power the algolia search index.

## Environmental VARS

```dotenv
ALGOLIA_APP_ID="VJ9GF38NJX"
ALGOLIA_API_KEY="" # write key needed
ALGOLIA_INDEX_NAME="docs-local" #docs-local for local dev index
```

## Scraping Locally

**From the www package**
1. First ensure site map has been generated on the www package. `SITE_URL=http://localhost:3000 npx next-sitemap`
2. Build and start the www package. `npx next build && npx next start`

**From the scraper package**
3. Run the scraper. `npx tsx src/main.ts` from the scraper package directory.

