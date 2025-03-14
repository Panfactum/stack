import { fixupPluginRules } from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import promise from "eslint-plugin-promise";
import tsParser from "@typescript-eslint/parser";
import js from "@eslint/js";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": fixupPluginRules(typescriptEslint),
      import: fixupPluginRules(_import),
      prettier,
      sonarjs: fixupPluginRules(sonarjs),
      unicorn: fixupPluginRules(unicorn),
      promise: fixupPluginRules(promise),
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
        process: "readonly",
        Bun: false,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {},
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/restrict-template-expressions": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
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
            match: false,
          },
        },
      ],

      "import/no-unresolved": "error",
      "import/order": [
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

      "import/no-cycle": "error",
      "import/no-duplicates": "error",
      "import/no-useless-path-segments": "error",

      "unicorn/filename-case": [
        "error",
        {
          cases: {
            kebabCase: true,
          },
        },
      ],

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

      // Add sonarjs rules directly
      "sonarjs/no-identical-expressions": "error",
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-redundant-jump": "error",
      "sonarjs/no-use-of-empty-return-value": "error",
      "sonarjs/no-inverted-boolean-check": "error",
      "sonarjs/no-all-duplicated-branches": "error",
      "sonarjs/no-element-overwrite": "error",
      "sonarjs/no-extra-arguments": "error",
      "sonarjs/no-identical-conditions": "error",
      "sonarjs/no-collection-size-mischeck": "error",
      "sonarjs/prefer-object-literal": "error",
      "sonarjs/prefer-single-boolean-return": "error",
      "sonarjs/no-duplicate-string": ["error", { threshold: 5 }],
      "sonarjs/cognitive-complexity": ["error", 20],
    },
  },
];
