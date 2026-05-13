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

// Inline plugin: custom MDX lint rules (fixable).
const mdxLocalPlugin = {
  rules: {
    // Ensures MDX list items are separated by blank lines.
    "loose-lists": {
      meta: {
        type: "layout",
        fixable: "whitespace",
        schema: [],
        messages: { missingBlankLine: "List item must be preceded by a blank line." },
      },
      create(context) {
        const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)]) /
        const FENCE_RE = /^\s*```/
        return {
          Program() {
            const source = context.sourceCode.getText()
            const lines = source.split("\n")
            let inCodeBlock = false
            let offset = 0
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i]
              if (FENCE_RE.test(line)) {
                inCodeBlock = !inCodeBlock
              } else if (!inCodeBlock && i > 0 && LIST_ITEM_RE.test(line) && lines[i - 1].trim() !== "") {
                const insertAt = offset
                context.report({
                  loc: { line: i + 1, column: 0 },
                  messageId: "missingBlankLine",
                  fix(fixer) {
                    return fixer.insertTextBeforeRange([insertAt, insertAt + line.length], "\n")
                  },
                })
              }
              offset += line.length + 1
            }
          },
        }
      },
    },

    // Ensures a space before footnote anchors like [^name].
    "footnote-spacing": {
      meta: {
        type: "layout",
        fixable: "whitespace",
        schema: [],
        messages: { missingSpace: "Footnote anchor must be preceded by a space." },
      },
      create(context) {
        const FENCE_RE = /^\s*```/
        // Matches a non-space character immediately before a footnote anchor [^...].
        // Excludes footnote definitions (lines starting with [^..]:) and link refs.
        const FOOTNOTE_ANCHOR_RE = /\S\[\^[^\]]+\]/g
        return {
          Program() {
            const source = context.sourceCode.getText()
            const lines = source.split("\n")
            let inCodeBlock = false
            let offset = 0
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i]
              if (FENCE_RE.test(line)) {
                inCodeBlock = !inCodeBlock
              } else if (!inCodeBlock) {
                // Skip footnote definition lines (e.g., [^name]:)
                if (/^\s*\[\^[^\]]+\]:/.test(line)) {
                  offset += line.length + 1
                  continue
                }
                let match
                FOOTNOTE_ANCHOR_RE.lastIndex = 0
                while ((match = FOOTNOTE_ANCHOR_RE.exec(line)) !== null) {
                  const charBeforeIdx = offset + match.index
                  const bracketIdx = charBeforeIdx + 1
                  context.report({
                    loc: { line: i + 1, column: match.index + 1 },
                    messageId: "missingSpace",
                    fix(fixer) {
                      return fixer.insertTextBeforeRange([bracketIdx, bracketIdx], " ")
                    },
                  })
                }
              }
              offset += line.length + 1
            }
          },
        }
      },
    },
  },
}

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
    plugins: { prettier: prettierPlugin, "mdx-local": mdxLocalPlugin },
    settings: { "mdx/code-blocks": false, "mdx/language-mapper": {} },
    rules: {
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "import-x/no-unresolved": "off",
      "unused-imports/no-unused-imports": "off",
      "mdx/remark": "error",
      "prettier/prettier": "error",
      "mdx-local/loose-lists": "error",
      "mdx-local/footnote-spacing": "error",
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
