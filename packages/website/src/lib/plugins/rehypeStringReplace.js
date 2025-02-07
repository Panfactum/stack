/* eslint-disable */
import { visit } from 'unist-util-visit';
import constants from "../constants.json";

/**
 * Rehype plugin to replace all text strings with a given replacement.
 * @param {string} replacement The string to replace all text nodes with.
 */
export default function rehypeReplaceStrings() {
    return (tree) => {
        visit(tree, 'text', (node) => {
            node.value = node.value
                .replaceAll("__PANFACTUM_VERSION_EDGE__", constants.panfactum_version_edge)
                .replaceAll("__PANFACTUM_VERSION_MAIN__", constants.panfactum_version_main);
        });
    };
}
