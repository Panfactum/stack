export function algoliaClient(appId: string, apiKey: string) {
  const baseURL = `https://${appId}.algolia.net`

  const request = async <T>(
    method: string,
    endpoint: string,
    data?: unknown,
  ): Promise<T> => {
    const url = `${baseURL}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      'x-algolia-application-id': appId,
      'x-algolia-api-key': apiKey,
    }

    const config: RequestInit = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    }

    try {
      const response = await fetch(url, config)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = (await response.json()) as T
      return result
    } catch (error) {
      console.error('Error making request:', error)
      throw error
    }
  }

  return {
    get: <T>(endpoint: string): Promise<T> => request<T>('GET', endpoint),
    post: <T>(endpoint: string, data: unknown): Promise<T> =>
      request<T>('POST', endpoint, data),
    put: <T>(endpoint: string, data: unknown): Promise<T> =>
      request<T>('PUT', endpoint, data),
    delete: <T>(endpoint: string): Promise<T> => request<T>('DELETE', endpoint),
  }
}
