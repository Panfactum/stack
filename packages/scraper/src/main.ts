import { createParsedHtmlSections } from '@/createParsedHtmlSections'
import { extractUrlsFromSitemap } from '@/extractUrlsFromSitemap'
import { scrapeUrls } from '@/scrapeUrls'
import { updateAlgoliaIndex } from '@/updateAlgoliaIndex'

const url = process.argv[2]

if (!url) {
  console.error('Panfactum XML URL not provided')
  process.exit(1)
}

const urls = await extractUrlsFromSitemap(url)
const scraped = await scrapeUrls(urls, true)
const sections = createParsedHtmlSections(scraped)

await updateAlgoliaIndex(sections)

console.log('completed indexing', sections.length)
