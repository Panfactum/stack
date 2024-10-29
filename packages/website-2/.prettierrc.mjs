export default {
  importOrder: ['<THIRD_PARTY_MODULES>', '^@/(.*)$', '^[./]'],
  singleQuote: true,
  semi: false,
  tabWidth: 2,
  trailingComma: 'all',
  plugins: ['prettier-plugin-astro', '@trivago/prettier-plugin-sort-imports'],
}
