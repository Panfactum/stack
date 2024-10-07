declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_ALGOLIA_APP_ID: string
    readonly NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY: string
    readonly NEXT_PUBLIC_ALGOLIA_INDEX_NAME: string
  }
}
