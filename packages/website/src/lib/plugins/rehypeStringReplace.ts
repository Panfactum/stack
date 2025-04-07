/* eslint-disable */
import { visit } from 'unist-util-visit';
import type { Root } from 'hast';
import { replaceVersionPlaceholders } from '../versions.ts';

export default function rehypeReplaceStrings() {
    return (tree: Root) => {
        visit(tree, 'text', (node) => {
            node.value = replaceVersionPlaceholders(node.value);
        });
    };
}
