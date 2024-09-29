import { algoliaClient } from '@/algolia.client'
import { consts } from '@/const'
import type { Section } from '@/createParsedHtmlSections'

const { appID, apiKey, index } = consts()

const client = algoliaClient(appID, apiKey)

export async function updateAlgoliaIndex (sections: Section[]) {
  await client.post('/1/indexes/' + index + '/clear')

  const requests = sections.map((section) => ({
    action: 'addObject',
    body: section
  }))

  await client.post('/1/indexes/' + index + '/batch', {
    requests
  })
}
