import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

interface MdastNode {
  type: string;
  name?: string;
  attributes?: Record<string, string>;
  children?: MdastNode[];
  data?: Record<string, unknown>;
}

/**
 * Remark plugin that converts `:term[display text]{#term-id}` text directives
 * (parsed by remark-directive) into `<span>` elements with a `data-term-id`
 * attribute so the rehype term popover plugin can enrich them with glossary data.
 */
const remarkTerm: Plugin = () => {
  return (tree) => {
    visit(tree, "textDirective", (node: MdastNode) => {
      if (node.name !== "term") return;

      const id = node.attributes?.id;
      if (!id) return;

      node.data = {
        hName: "span",
        hProperties: {
          "data-term-id": id,
          class: "term-popover-trigger",
        },
      };
    });
  };
};

export default remarkTerm;
