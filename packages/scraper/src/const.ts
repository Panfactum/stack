export const appID = process.env.ALGOLIA_APP_ID
export const apiKey = process.env.ALGOLIA_API_KEY
export const tmpDir = process.env.TMP_DIR

export function consts () {
  if (appID === undefined || apiKey === undefined) {
    throw new Error('Missing Algolia environment variables')
  }

  return { appID, apiKey, tmpDir }
}
