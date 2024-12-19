import type { AxiosError } from 'axios'
import axios from 'axios'
import * as rax from 'retry-axios'

import { consts } from '@/const'
import fs from 'node:fs'

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
  const cachePath = `${tmpDir}/scraped.json`
  if (useCache && fs.existsSync(cachePath)) {
    console.log('existing scraped.json found and using cache')
    const jsonFile = fs.readFileSync(cachePath)
    return JSON.parse(jsonFile.toString())
  }

  const results = []
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

    console.log('scraped', url, result.error)
  }

  if (tmpDir) {
    fs.writeFileSync(`${tmpDir}/scraped.json`, JSON.stringify(results))
  }

  return results
}
