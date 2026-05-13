import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

interface MdastNode {
  type: string;
  name?: string;
  children?: MdastNode[];
  data?: Record<string, unknown>;
}

/**
 * Remark plugin that detects `:collapsible` text directives (parsed by
 * remark-directive) inside headings, removes them, and marks the heading
 * with `data.hProperties['data-collapsible']` so the rehype collapsible
 * plugin can find it after slug/autolink processing.
 */
const remarkCollapsible: Plugin = () => {
  return (tree) => {
    visit(tree, "heading", (node: MdastNode) => {
      if (!node.children) return;

      const directiveIndex = node.children.findIndex(
        (child) =>
          child.type === "textDirective" && child.name === "collapsible",
      );
      if (directiveIndex === -1) return;

      // Remove the :collapsible directive from the heading children
      node.children.splice(directiveIndex, 1);

      // Mark the heading so the rehype plugin can detect it
      const existing = (node.data ?? {});
      const existingProps = (existing.hProperties ?? {}) as Record<
        string,
        unknown
      >;
      node.data = {
        ...existing,
        hProperties: {
          ...existingProps,
          "data-collapsible": "true",
        },
      };
    });
  };
};

export default remarkCollapsible;
