/** @type {import('tailwindcss').Config} */
export default {
  content: [
      "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
  ],
  theme: {
    screens: {
      "sm": "40rem",
      "md": "48rem",
      "lg": "64rem",
      "xl": "80rem",
      "2xl": "96rem",
      "3xl": "120rem"
    },
    colors: {
      black: "#000000",
      white: "#ececeb",
      transparent: "#ffffff00",
      offWhite: "#dcdcdc",
      brand: {
        25: "#e9f7ff",
        50: "#e6f4fc",
        100: "#ceeaf8",
        200: "#9ad3f1",
        300: "#70bfeb",
        400: "#50a9e6",
        500: "#3b81b0",
        550: "#316d95",
        600: "#27597a",
        650: "#245371",
        700: "#224d69",
        750: "#1a3b50",
        800: "#153245",
        900: "#091a25",
        950: "#040e12",
      },
      success: {
        25: "#f6fef9",
        50: "#ecfdf3",
        100: "#dcfae6",
        200: "#abefc6",
        300: "#75e0a7",
        400: "#47cd89",
        500: "#17b26a",
        600: "#079455",
        700: "#067647",
        800: "#085d3a",
        900: "#074d31",
        950: "#053321",
      },
      error: {
        25: "#fffbfa",
        50: "#fef3f2",
        100: "#fee4e2",
        200: "#fecdca",
        300: "#fda29b",
        400: "#f97066",
        500: "#f04438",
        600: "#d92d20",
        700: "#b42318",
        800: "#912018",
        900: "#7a271a",
        950: "#55160c",
      },
      warning: {
        25: "#fffcf5",
        50: "#fffaeb",
        100: "#fef0c7",
        200: "#fedf89",
        300: "#fec84b",
        400: "#fdb022",
        500: "#f79009",
        600: "#dc6803",
        700: "#b54708",
        800: "#93370d",
        900: "#7a2e0e",
        950: "#4e1d09",
      },
      gray: {
        "dark-mode": {
          25: "#fafafa",
          50: "#f5f5f6",
          100: "#f0f1f1",
          200: "#ececed",
          300: "#cecfd2",
          400: "#94969c",
          500: "#85888e",
          600: "#61646c",
          700: "#333741",
          800: "#1f242f",
          900: "#161b26",
          950: "#0c111d",
        },
        "light-mode": {
          25: "#fcfdfd",
          50: "#f9fafb",
          100: "#f2f5f7",
          150: "#ebeff1",
          200: "#e4e9ec",
          300: "#d0d8dd",
          400: "#98a8b3",
          500: "#667985",
          600: "#475a67",
          700: "#344754",
          800: "#182630",
          900: "#101e28",
          950: "#0c161d",
        },
        "warm": {
          25: "#fdfdfc",
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d7d3d0",
          400: "#a9a29d",
          500: "#79716b",
          600: "#57534e",
          700: "#44403c",
          800: "#292524",
          900: "#1c1917",
          950: "#171412",
        },
        "modern": {
          25: "#fcfcfd",
          50: "#f8fafc",
          100: "#eef2f6",
          200: "#e3e8ef",
          300: "#cdd5df",
          400: "#9aa4b2",
          500: "#697586",
          600: "#4b5565",
          700: "#364152",
          800: "#202939",
          900: "#111927",
          950: "#0d121c",
        },
        "neutral": {
          25: "#fcfcfd",
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d2d6db",
          400: "#9da4ae",
          500: "#6c737f",
          600: "#4d5761",
          700: "#384250",
          800: "#1f2a37",
          900: "#111927",
          950: "#0d121c",
        },
      }
    },
    extend: {
      minWidth: {
        sm: "480px",
      },
      blur: {
        xs: "1px"
      },
      spacing: {
        "1.5": "0.375rem",
        "3.5": "0.875rem",
        "112": "28rem",
        "128": "32rem",
        "144": "36rem",
        "168": "42rem",
        "192": "48rem",
        "224": "56rem",
        "256": "64rem",
        "288": "72rem",
        "320": "80rem",
        "1/5": "20%",
        "2/5": "40%",
        "3/5": "50%",
        "4/5": "80%",
        "1/6": "calc(100%/6)",
        "2/6": "calc(100%/6*2)",
        "3/6": "calc(100%/6*3)",
        "4/6": "calc(100%/6*4)",
        "5/6": "calc(100%/6*5)"
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
        machina: ["neue-machina", "sans-serif"],
        montreal: ["neue-montreal-mono", "monospace"],
      },
      backgroundImage: {
        "hero-pattern": "url('/hero-pattern.svg')",
      },
      zIndex: {
        "top-navigation": 400,
        "top-navigation-mobile-menu": 405,
        "content-fixed-navigation": 407,
        "fixed-side-panel": 410,
        drawer: 500,
      },
      keyframes: {
        "kobalte-collapsible-down": {
          from: { height: "0" },
          to: { height: "var(--kb-collapsible-content-height)" },
        },
        "kobalte-collapsible-up": {
          from: { height: "var(--kb-collapsible-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "kobalte-collapsible-down": "kobalte-collapsible-down 0.4s ease-out",
        "kobalte-collapsible-up": "kobalte-collapsible-up 0.4s ease-in",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/forms")
  ],
};
