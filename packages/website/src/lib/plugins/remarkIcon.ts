import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

interface MdastNode {
  type: string;
  name?: string;
  value?: string;
  children?: MdastNode[];
  data?: Record<string, unknown>;
}

/**
 * Remark plugin that detects `:icon[name]` text directives (parsed by
 * remark-directive) inside headings, removes them, and marks the heading
 * with `data.hProperties['data-icon']` so the rehype icon plugin can
 * find it after slug/autolink processing.
 */
const remarkIcon: Plugin = () => {
  return (tree) => {
    visit(tree, "heading", (node: MdastNode) => {
      if (!node.children) return;

      const directiveIndex = node.children.findIndex(
        (child) =>
          child.type === "textDirective" && child.name === "icon",
      );
      if (directiveIndex === -1) return;

      const directive = node.children[directiveIndex];

      // Extract the icon name from the directive's text children (the [name] label)
      let iconName = "";
      if (directive.children) {
        iconName = directive.children
          .filter((c) => c.type === "text" && c.value)
          .map((c) => c.value)
          .join("")
          .trim();
      }

      if (!iconName) return;

      // Remove the :icon[name] directive from the heading children
      node.children.splice(directiveIndex, 1);

      // Trim leading whitespace on the next sibling text node
      if (directiveIndex < node.children.length) {
        const nextChild = node.children[directiveIndex];
        if (nextChild.type === "text" && nextChild.value) {
          nextChild.value = nextChild.value.replace(/^\s+/, "");
        }
      }

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
          "data-icon": iconName,
        },
      };
    });
  };
};

export default remarkIcon;
