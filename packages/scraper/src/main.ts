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

// removing urls that are not scraping or indexing friendly
const urlBlacklist = [
  '/changelog'
]

const filtered_urls = urls.filter(url => {
  return !urlBlacklist.some(blacklist => url.includes(blacklist))
})

const scraped = await scrapeUrls(filtered_urls, true)
const sections = createParsedHtmlSections(scraped)

await updateAlgoliaIndex(sections, indexName)

console.log('completed indexing', sections.length)
