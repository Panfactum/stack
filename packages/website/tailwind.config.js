import theme from './theme.js'

/** @type {import('tailwindcss').Config} */
module.exports = {
  important: '#root',
  corePlugins: {
    preflight: false
  },
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/mdx-components.tsx",
  ],
  theme: {
    colors: theme.colors,
    screens: {
      sm: `${theme.screens.sm}px`,
      md: `${theme.screens.md}px`,
      lg: `${theme.screens.lg}px`,
      xl: `${theme.screens.xl}px`,
      "2xl": `${theme.screens["2xl"]}px`
    }
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
  mode:"jit"
}
