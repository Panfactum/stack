module.exports = {
    extends: [
        'eslint:recommended',
        "standard",
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:@typescript-eslint/strict'
    ],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'react', "unused-imports", "mui-path-imports"],
    rules: {
      "mui-path-imports/mui-path-imports": "error",
      indent: ["error", 2],
      "no-void": "off",
      "camelcase": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          "checksVoidReturn": false
        }
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
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": "off",
        "unused-imports/no-unused-imports": "error",
        "unused-imports/no-unused-vars": [
            "error",
            { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }
        ],
      "react/jsx-max-props-per-line": ["warn", {"maximum": 1, "when": "always"}],
      "react/jsx-first-prop-new-line": ["warn", "multiline"],
      "react/jsx-closing-tag-location": ["warn", true],
      "react/jsx-closing-bracket-location": ["warn", "tag-aligned"],
      "react/self-closing-comp": ["warn", {"component": true, "html": true}],
      "react/jsx-one-expression-per-line": ["warn", {"allow": "literal"}],
      "react/jsx-indent": ["error", 2, {checkAttributes: true, indentLogicalExpressions: true}],
        "react/jsx-uses-react": "error",
        "react/jsx-uses-vars": "error",
        "react/display-name": "off"
    },
    overrides: [{
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        project: ['./tsconfig.json']
      }
    }]
};
