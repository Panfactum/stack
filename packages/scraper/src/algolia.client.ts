import axios from 'axios'

export function algoliaClient (appId: string, apiKey: string) {
  return axios.create({
    baseURL: `https://${appId}.algolia.net`,
    headers: {
      'x-algolia-application-id': appId,
      'x-algolia-api-key': apiKey
    }
  })
}
