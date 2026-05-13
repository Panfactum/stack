import type { Element, ElementContent, Root, RootContent } from "hast";
import type { Plugin } from "unified";
import { SKIP, visit } from "unist-util-visit";

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function headingLevel(tagName: string): number {
  return parseInt(tagName[1], 10);
}

function isCollapsibleHeading(node: Element): boolean {
  return (
    HEADING_TAGS.has(node.tagName) &&
    node.properties["dataCollapsible"] === "true"
  );
}

function isHeadingAtOrAbove(
  node: ElementContent | RootContent,
  level: number,
): boolean {
  return (
    node.type === "element" &&
    HEADING_TAGS.has(node.tagName) &&
    headingLevel(node.tagName) <= level
  );
}

/**
 * Rehype plugin that transforms headings marked with `data-collapsible`
 * (set by remarkCollapsible) into `<details>/<summary>` wrappers.
 * Collects all siblings after the heading until the next heading of the
 * same or higher level, and wraps them as the collapsible body.
 * The heading element stays in the tree so Astro's TOC extraction finds it.
 */
const rehypeCollapsible: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (index === undefined || !parent || !isCollapsibleHeading(node)) return;

      // Remove the marker attribute from the rendered output
      delete node.properties["dataCollapsible"];

      const siblings = parent.children;
      const level = headingLevel(node.tagName);

      // Collect body nodes: everything after this heading until the next
      // heading at the same or higher level (or end of parent)
      let endIndex = index + 1;
      while (endIndex < siblings.length) {
        const sibling = siblings[endIndex];
        if (isHeadingAtOrAbove(sibling, level)) break;
        endIndex++;
      }

      const bodyNodes = siblings.slice(index + 1, endIndex) as ElementContent[];

      const detailsElement: Element = {
        type: "element",
        tagName: "details",
        properties: { className: "collapsible-section" },
        children: [
          {
            type: "element",
            tagName: "summary",
            properties: {},
            children: [node],
          },
          {
            type: "element",
            tagName: "div",
            properties: { className: "collapsible-content" },
            children: bodyNodes,
          },
        ],
      };

      // Replace heading + body nodes with the details element
      parent.children.splice(index, endIndex - index, detailsElement);

      return [SKIP, index + 1];
    });
  };
};

export default rehypeCollapsible;
