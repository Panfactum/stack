export const appID = process.env.ALGOLIA_APP_ID
export const apiKey = process.env.ALGOLIA_API_KEY
export const index = process.env.ALGOLIA_INDEX_NAME
export const tmpDir = process.env.TMP_DIR

export function consts () {
  if (appID === undefined || apiKey === undefined || index === undefined) {
    throw new Error('Missing Algolia environment variables')
  }

  return { appID, apiKey, index, tmpDir }
}
