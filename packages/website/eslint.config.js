import { fixupPluginRules } from "@eslint/compat"
import js from "@eslint/js"
import { dirname } from "path"
import { fileURLToPath } from "url"
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"
import * as astro from "eslint-plugin-astro"
import betterTailwindcss from "eslint-plugin-better-tailwindcss"
import cssModulesNext from "eslint-plugin-css-modules-next"
import importX from "eslint-plugin-import-x"
import jsxA11y from "eslint-plugin-jsx-a11y"
import * as mdx from "eslint-plugin-mdx"
import prettierPlugin from "eslint-plugin-prettier"
import solid from "eslint-plugin-solid"
import unusedImports from "eslint-plugin-unused-imports"
import globals from "globals"
import tseslint from "typescript-eslint"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
  // 1. Global ignores (replaces top-level ignorePatterns)
  {
    ignores: [
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "**/*.md",
      "**/*.png",
      "**/*.mdx/*.ts",
      "**/*.mdx/*.tsx",
      "**/reference.mdx",
    ],
  },

  // 2. Base rules for all TS/TSX files
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
        extraFileExtensions: [".astro", ".mdx"],
      },
    },
    plugins: { "unused-imports": unusedImports },
    rules: {
      "no-console": "error",
      "no-unused-vars": "off",
      // New ESLint v10 recommended rules — not in original config, off to avoid new errors
      "no-unassigned-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Allow numbers in template literals — widespread pattern in the codebase
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },

  // 3. import-x
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          project: __dirname + "/tsconfig.json",
          alwaysTryTypes: true,
        }),
      ],
      "import-x/extensions": [".ts", ".tsx", ".mdx"],
      "import-x/parsers": { "@typescript-eslint/parser": [".ts", ".tsx"] },
    },
    rules: {
      "import-x/no-unresolved": [2, { ignore: ["astro:.*$", ".*?raw$"] }],
      "import-x/order": [
        "error",
        {
          groups: ["external", "internal"],
          "newlines-between": "always",
          alphabetize: { order: "asc" },
        },
      ],
    },
  },

  // 4. jsx-a11y (fixupPluginRules for ESLint v10 compat)
  {
    plugins: { "jsx-a11y": fixupPluginRules(jsxA11y) },
    rules: jsxA11y.configs.recommended.rules,
  },

  // 5. CSS Modules (replaces abandoned eslint-plugin-css-modules)
  cssModulesNext.configs.recommended,

  // 6. TSX files — SolidJS + Prettier + better-tailwindcss
  {
    files: ["**/*.tsx"],
    plugins: {
      solid: fixupPluginRules(solid),
      prettier: prettierPlugin,
      "better-tailwindcss": betterTailwindcss,
    },
    settings: { "better-tailwindcss": { entryPoint: __dirname + "/src/styles/global.css" } },
    rules: {
      "prettier/prettier": "error",
      // better-tailwindcss v4 rules
      "better-tailwindcss/enforce-consistent-variable-syntax": "error",
      "better-tailwindcss/no-unknown-classes": [
        "error",
        {
          ignore: [
            "content",
            "masonry-item",
            "masonry-sizer",
            "group",
            "subtitle",
            "presentation-controls",
          ],
        },
      ],
      // solid rules
      "solid/jsx-no-duplicate-props": 2,
      "solid/jsx-no-undef": [2, { typescriptEnabled: true }],
      "solid/jsx-uses-vars": 2,
      "solid/no-innerhtml": 2,
      "solid/jsx-no-script-url": 2,
      "solid/components-return-once": 1,
      "solid/no-destructure": 2,
      "solid/prefer-for": 2,
      "solid/reactivity": 1,
      "solid/event-handlers": 1,
      "solid/imports": 1,
      "solid/style-prop": 1,
      "solid/no-react-deps": 1,
      "solid/no-react-specific-props": 1,
      "solid/self-closing-comp": 1,
    },
  },

  // 7. MDX files
  {
    files: ["**/*.mdx"],
    extends: [mdx.flat, tseslint.configs.disableTypeChecked],
    settings: { "mdx/code-blocks": false, "mdx/language-mapper": {} },
    rules: {
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "import-x/no-unresolved": "off",
      "unused-imports/no-unused-imports": "off",
      "mdx/remark": "error",
    },
  },

  // 8. Astro files — spread flat/recommended at the top level so each config
  // entry keeps its own files pattern (the plugin uses separate entries for
  // *.astro vs *.astro/*.ts virtual files). Using extends would override all
  // patterns to "**/*.astro", making the TS parser apply to .astro files.
  ...astro.configs["flat/recommended"],
  {
    files: ["**/*.astro"],
    extends: [tseslint.configs.disableTypeChecked],
    processor: "astro/client-side-ts",
    rules: {
      "astro/no-conflict-set-directives": "error",
      "astro/no-unused-define-vars-in-style": "error",
    },
  },

  // 9. Astro client-side scripts
  {
    files: ["**/*.astro/*.ts", "*.astro/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
    rules: { "prettier/prettier": "off" },
  },
)
