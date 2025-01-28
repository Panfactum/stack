declare namespace astroHTML.JSX {
  interface HTMLAttributes {
    'breakpoints'?: number[];
  }
}

interface ImportMetaEnv {
  readonly ALGOLIA_APP_ID: string;
  readonly ALGOLIA_SEARCH_API_KEY: string;
  readonly ALGOLIA_INDEX_NAME: string;
  readonly NODE_ENV: "development" | "production";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}