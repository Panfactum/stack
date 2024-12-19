import { algoliaClient } from '@/algolia.client'
import { consts } from '@/const'
import type { Section } from '@/createParsedHtmlSections'

const { appID, apiKey } = consts()

const client = algoliaClient(appID, apiKey)

export async function updateAlgoliaIndex (sections: Section[], indexName: string) {
  await client.post('/1/indexes/' + indexName + '/clear')

  const requests = sections.map((section) => ({
    action: 'addObject',
    body: section
  }))

  await client.post('/1/indexes/' + indexName + '/batch', {
    requests
  })
}
