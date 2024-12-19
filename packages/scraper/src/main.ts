import { createParsedHtmlSections } from '@/createParsedHtmlSections'
import { extractUrlsFromSitemap } from '@/extractUrlsFromSitemap'
import { scrapeUrls } from '@/scrapeUrls'
import { updateAlgoliaIndex } from '@/updateAlgoliaIndex'

const [_, __, url, indexName] = process.argv

if (!url) {
  console.error('Panfactum XML URL not provided')
  process.exit(1)
}

if (!indexName) {
  console.error('Algolia index name not provided')
  process.exit(1)
}

const urls = await extractUrlsFromSitemap(url)
const scraped = await scrapeUrls(urls, true)
const sections = createParsedHtmlSections(scraped)

await updateAlgoliaIndex(sections, indexName)

console.log('completed indexing', sections.length)
