import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

interface MdastNode {
  type: string;
  name?: string;
  children?: MdastNode[];
  data?: Record<string, unknown>;
}

/**
 * Remark plugin that detects `:numbered` text directives (parsed by
 * remark-directive) inside headings, removes them, and marks the heading
 * with `data.hProperties['data-numbered']` so the rehype numbered
 * plugin can find it after slug/autolink processing.
 */
const remarkNumbered: Plugin = () => {
  return (tree) => {
    visit(tree, "heading", (node: MdastNode) => {
      if (!node.children) return;

      const directiveIndex = node.children.findIndex(
        (child) =>
          child.type === "textDirective" && child.name === "numbered",
      );
      if (directiveIndex === -1) return;

      // Remove the :numbered directive from the heading children
      node.children.splice(directiveIndex, 1);

      // Mark the heading so the rehype plugin can detect it
      const existing = node.data ?? {};
      const existingProps = (existing.hProperties ?? {}) as Record<
        string,
        unknown
      >;
      node.data = {
        ...existing,
        hProperties: {
          ...existingProps,
          "data-numbered": "true",
        },
      };
    });
  };
};

export default remarkNumbered;
