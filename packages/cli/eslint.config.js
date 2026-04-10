import { fixupPluginRules } from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import importX from "eslint-plugin-import-x";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import prettier from "eslint-plugin-prettier";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import promise from "eslint-plugin-promise";
import tsParser from "@typescript-eslint/parser";
import unusedImports from "eslint-plugin-unused-imports"
import js from "@eslint/js";
import globals from "globals";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": fixupPluginRules(typescriptEslint),
      "import-x": importX,
      prettier,
      sonarjs,
      unicorn,
      promise: fixupPluginRules(promise),
      "unused-imports": unusedImports,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: "module",
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"],
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        Bun: false,
        BlobPropertyBag: "readonly",
      },
    },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver({ project: __dirname + "/tsconfig.json" })],
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/restrict-template-expressions": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          "vars": "all",
          "varsIgnorePattern": "^_",
          "args": "after-used",
          "argsIgnorePattern": "^_",
        },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: ["typeLike"],
          format: ["PascalCase"],
        },
        {
          selector: ["function", "variable", "parameter"],
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: {
            regex: "^I[A-Z]",
            match: true,
          },
        },
      ],

      "import-x/no-unresolved": ["error", { ignore: ["^bun:"] }],
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling"],
            "index",
            "object",
            "type",
          ],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],

      "import-x/no-cycle": "error",
      "import-x/no-duplicates": "error",
      "import-x/no-useless-path-segments": "error",
      "no-console": [
        "warn",
        {
          allow: ["warn", "error", "info"],
        },
      ],

      eqeqeq: "error",
      "no-return-await": "error",
      "no-throw-literal": "error",
      "prefer-const": "error",
      "no-var": "error",
      "no-dupe-class-members": "off",
      "@typescript-eslint/no-dupe-class-members": "error",

      // Add sonarjs rules directly
      "sonarjs/no-identical-expressions": "error",
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-redundant-jump": "error",
      "sonarjs/no-use-of-empty-return-value": "error",
      "sonarjs/no-ignored-return": "error",
      "sonarjs/no-inverted-boolean-check": "error",
      "sonarjs/no-all-duplicated-branches": "error",
      "sonarjs/no-element-overwrite": "error",
      "sonarjs/no-extra-arguments": "error",
      "sonarjs/no-identical-conditions": "error",
      "sonarjs/no-collection-size-mischeck": "error",
      "sonarjs/prefer-object-literal": "error",
      "sonarjs/prefer-single-boolean-return": "error",
      "sonarjs/no-duplicate-string": ["error", { threshold: 10 }]
    },
  },
];
