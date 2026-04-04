// Shared utilities for changelog page routing and content ID manipulation.
// Extracted into a module so they can be used in both getStaticPaths and the rendering scope.

/**
 * Converts a changelog content ID to the canonical release tag used in URLs.
 * e.g. "edge/25-04-03/log" → "edge.25-04-03"
 * e.g. "stable/25-04/0/log" → "stable.25-04.0"
 * e.g. "main/log" → "main"
 */
export function contentIdToUrlParam(id: string): string {
    const parts = id.split('/');
    if (parts[0] === 'main') {
        return 'main';
    }
    if (parts[0] === 'stable') {
        // stable/25-04/0/log → stable.25-04.0
        const channel = parts[1] ?? '';
        const patch = parts[2] ?? '';
        return `stable.${channel}.${patch}`;
    }
    return `${parts[0]}.${parts[1]}`;
}

/**
 * Extracts the stable channel slug from a stable entry's content ID.
 * e.g. "stable/25-04/0/log" → "stable.25-04"
 */
export function getStableChannelFromId(id: string): string {
    const channel = id.split('/')[1] ?? '';
    return `stable.${channel}`;
}

/**
 * Converts a DOCS_VERSIONS slug to a changelog URL slug.
 * The docs directory uses hyphens (stable-25-04) while changelog URLs use dots (stable.25-04).
 * Non-stable slugs pass through unchanged.
 */
export function docsSlugToChangelogSlug(slug: string): string {
    if (slug.startsWith('stable-')) {
        return 'stable.' + slug.slice('stable-'.length);
    }
    return slug;
}

/**
 * Extracts the directory key from a content entry ID for matching purposes.
 * Strips the filename segment (e.g. "log") to get the parent directory path.
 * e.g. "edge/24-06-02/log" → "edge/24-06-02"
 * e.g. "stable/25-04/0/log" → "stable/25-04/0"
 * e.g. "main/log" → "main"
 */
export function getDirKey(id: string): string {
    const lastSlash = id.lastIndexOf('/');
    return lastSlash >= 0 ? id.slice(0, lastSlash) : id;
}

const INTERNAL_COMMIT_SHA_RE = /^[0-9a-f]{40}$/;

/**
 * Resolves a changelog reference link to a full URL.
 * For internal-commit references the link is a bare 40-character SHA;
 * this converts it to a GitHub commit URL.
 */
export function resolveReferenceLink(type: string, link: string): string {
    if (type === 'internal-commit' && INTERNAL_COMMIT_SHA_RE.test(link)) {
        return `https://github.com/Panfactum/stack/commit/${link}`;
    }
    return link;
}
