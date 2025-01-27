module.exports = {
  root: true,
  plugins: [
    "unused-imports",
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:jsx-a11y/recommended",
    "plugin:astro/recommended",
    "plugin:tailwindcss/recommended"
  ],
  parserOptions: {
    project: ['./tsconfig.json'],
    extraFileExtensions: ['.astro']
  },
  rules: {
    "no-console": "error",
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
    "import/order": ["error", {
      "groups": [
        "external",
        "internal"
      ],
      "newlines-between": "always",
      "alphabetize": {
        "order": "asc"
      }
    }],
    "import/no-unresolved": [2, { ignore: [
        'astro:.*$',
        '.*?raw$'
      ]}]
  },
  settings: {
    "import/resolver": {
      // You will also need to install and configure the TypeScript resolver
      // See also https://github.com/import-js/eslint-import-resolver-typescript#configuration
      "typescript": true,
      "node": true,
    },
    "import/extensions": [
      ".ts",
      ".tsx"
    ],
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    tailwindcss: {
      whitelist: [
          "circling-icon",
          "circling-planets",
          "hero-icon",
      ]
    }
  },
  overrides: [
    {
      files: ["*.tsx"],
      plugins: [
          "@typescript-eslint",
          "solid"
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      rules: {

        // identifier usage is important
        "solid/jsx-no-duplicate-props": 2,
        "solid/jsx-no-undef": [2, { typescriptEnabled: true }],
        "solid/jsx-uses-vars": 2,
        // security problems
        "solid/no-innerhtml": 2,
        "solid/jsx-no-script-url": 2,
        // reactivity
        "solid/components-return-once": 1,
        "solid/no-destructure": 2,
        "solid/prefer-for": 2,
        "solid/reactivity": 1,
        "solid/event-handlers": 1,
        // these rules are mostly style suggestions
        "solid/imports": 1,
        "solid/style-prop": 1,
        "solid/no-react-deps": 1,
        "solid/no-react-specific-props": 1,
        "solid/self-closing-comp": 1,
        "solid/no-array-handlers": 0,
        "solid/no-unknown-namespaces": 0,
      }
    },
    {
      files: ["*.astro"],
      plugins: ["astro"],
      env: {
        node: true,
        "astro/astro": true,
        es2020: true,
      },
      processor: "astro/client-side-ts",
      parser: "astro-eslint-parser",
      parserOptions: {
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".astro"],
        // The script of Astro components uses ESM.
        sourceType: "module",
      },
      rules: {
        "astro/no-conflict-set-directives": "error",
        "astro/no-unused-define-vars-in-style": "error",
      },
    }
  ],
}