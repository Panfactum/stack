// This file is only used for linting. See the next.config.mjs file for
// build configuration

const remarkConfig = {
    plugins: [
        "remark-preset-lint-consistent", // Check that markdown is consistent.
        "remark-preset-lint-recommended", // Few recommended rules.
        ["remark-lint-list-item-indent", "space"],
        ["remark-lint-no-dead-urls", ['error', {
            skipUrlPatterns: [
                /^.*__currentPanfactumVersion__.*$/, // ignore custom interpolation
                /^.*cloudflare\.com.*$/, // cloudflare returns a 403 when using cli tools to access their sites
                /^.*medium\.com.*$/ // medium returns 103
            ],
            skipLocalhost: true
        }]],
        ["remark-lint-no-duplicate-headings", ['error']],
        ['remark-lint-no-empty-url', ['error']],
        ['remark-lint-fenced-code-flag', ['error']],
        ['remark-lint-heading-increment', ['error']],
        'remark-mdx',
        'remark-gfm',
        'remark-math'
    ]
}

export default remarkConfig