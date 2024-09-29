import axios from 'axios'
import { parse } from 'node-html-parser'

/**
 * a script that takes an sitemap and extracts all the urls from it
 */

export async function extractUrlsFromSitemap (
  sitemapUrl: string
): Promise<string[]> {
  const sitemap = await axios.get<string>(sitemapUrl).then((res) => res.data)

  const isSiteMapIndex = sitemap.includes('<sitemapindex')

  const dom = parse(sitemap)

  /*
   if the sitemap is an index, than only references to other indexes are available
    and we need to extract the urls from the sitemaps
   */
  if (isSiteMapIndex) {
    const sitemaps = dom.querySelectorAll('sitemap > loc')

    const urls = await Promise.all(
      Array.from(sitemaps).map((sitemap) => {
        if (!sitemap.textContent) {
          return null
        }
        return extractUrlsFromSitemap(sitemap.textContent)
      })
    )

    return urls.flatMap((url) => url).filter((url) => url !== null)
  }

  const urls = dom.querySelectorAll('url > loc')

  return Array.from(urls)
    .map((url) => url.textContent)
    .filter((url) => url !== null)
}
