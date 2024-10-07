module.exports = {
  plugins: [
    "tailwindcss",
    "autoprefixer",
    "postcss-flexbugs-fixes",
    [
      "postcss-preset-env",
      {
        "autoprefixer": {
          "flexbox": "no-2009"
        },
        "stage": 3,
        "features": {
          "custom-properties": false
        }
      }
    ],
    [
      '@fullhuman/postcss-purgecss',
      {
        content: [
          "./src/app/**/*.{js,ts,jsx,tsx}",
          "./src/pages/**/*.{js,ts,jsx,tsx}",
          "./src/components/**/*.{js,ts,jsx,tsx}",
          "./src/mdx-components.tsx",
        ],
        defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
        safelist: {
          standard: [/html/, /body/, /tsqd-parent-container/],
          greedy: [/katex/, /Mui/, /ais/]
        },
      }
    ]
  ]
}
