import type { AxiosError } from 'axios'
import axios from 'axios'
import * as rax from 'retry-axios'

import { consts } from '@/const'
import fs from 'node:fs'
import readline from 'node:readline'

export interface ScrapedUrl {
  url: string;
  content: string;
  error?: string;
}

const scraperClient = axios.create({
  validateStatus: (status) => status >= 200 && status < 400
})

rax.attach(scraperClient)

const { tmpDir } = consts()
console.log('tmpDir', tmpDir)

export async function scrapeUrls (urls: string[], useCache = false): Promise<ScrapedUrl[]> {
  const cachePath = tmpDir ? `${tmpDir}/scraped.ndjson` : undefined

  if (useCache && cachePath && fs.existsSync(cachePath)) {
    console.log('existing scraped cache found and using cache')
    return await loadCache(cachePath)
  }

  // Stream results to disk one line at a time. Building a single
  // JSON.stringify(results) at the end requires a contiguous temporary
  // string roughly 2x the size of the scraped HTML (V8 uses a 16-bit
  // string buffer), which OOMs the container on large sitemaps.
  const cacheStream = cachePath ? fs.createWriteStream(cachePath) : undefined

  const results: ScrapedUrl[] = []
  for (const [index, url] of urls.entries()) {
    console.log(index + 1, 'of', urls.length)
    console.log('hitting url', url)
    const result: ScrapedUrl = await scraperClient.get<string>(url, {
      raxConfig: {
        retry: 3,
        retryDelay: 1000,
        backoffType: 'exponential',
        onRetryAttempt: (err) => {
          console.log('retrying', url, err.status, err.message)
        }
      }
    }).then((res) => ({ url, content: res.data })).catch((err: Error | AxiosError) => ({
      url,
      content: '',
      error: axios.isAxiosError(err) ? `${err.message} ${err.response?.status} ${err.response?.statusText}` : err.message
    }))

    results.push(result)
    cacheStream?.write(JSON.stringify(result) + '\n')

    console.log('scraped', url, result.error)
  }

  if (cacheStream) {
    await new Promise<void>((resolve, reject) => {
      cacheStream.once('error', reject)
      cacheStream.end(resolve)
    })
  }

  return results
}

async function loadCache (cachePath: string): Promise<ScrapedUrl[]> {
  const results: ScrapedUrl[] = []
  const rl = readline.createInterface({
    input: fs.createReadStream(cachePath),
    crlfDelay: Infinity
  })
  for await (const line of rl) {
    if (line.length === 0) continue
    results.push(JSON.parse(line) as ScrapedUrl)
  }
  return results
}
