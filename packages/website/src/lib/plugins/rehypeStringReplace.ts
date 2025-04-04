/* eslint-disable */
import { visit } from 'unist-util-visit';
import type { Root } from 'hast';
import { replaceVersionPlaceholders } from '../versions.ts';

/**
 * Rehype plugin to replace all text strings with a given replacement.
 * @param {string} replacement The string to replace all text nodes with.
 */
export default function rehypeReplaceStrings() {
    return (tree: Root) => {
        visit(tree, 'text', (node) => {
            node.value = replaceVersionPlaceholders(node.value);
        });
    };
}
