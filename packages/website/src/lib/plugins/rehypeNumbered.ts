import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function headingLevel(tagName: string): number {
  return parseInt(tagName[1], 10);
}

function isNumberedHeading(node: Element): boolean {
  return (
    HEADING_TAGS.has(node.tagName) &&
    node.properties["dataNumbered"] === "true"
  );
}

/**
 * Rehype plugin that transforms headings marked with `data-numbered`
 * (set by remarkNumbered) into numbered headings with a circle badge.
 *
 * Sets a `data-number` attribute on the heading and adds a
 * `numbered-heading` class. The number is rendered via a CSS `::before`
 * pseudo-element so it does not appear in the heading's text content
 * (which Astro extracts for the table of contents sidebar).
 *
 * Maintains a counter per heading level that resets when a non-numbered
 * heading at the same or higher level appears.
 */
const rehypeNumbered: Plugin<[], Root> = () => {
  return (tree: Root) => {
    const counters = new Map<number, number>();

    visit(tree, "element", (node) => {
      if (!HEADING_TAGS.has(node.tagName)) return;

      const level = headingLevel(node.tagName);

      if (isNumberedHeading(node)) {
        // Remove the marker attribute from the rendered output
        delete node.properties["dataNumbered"];

        // Increment counter for this heading level
        const current = (counters.get(level) ?? 0) + 1;
        counters.set(level, current);

        // Add class and data attribute for CSS rendering
        const existing = (node.properties.className ?? []) as string[];
        node.properties.className = [...existing, "numbered-heading"];
        node.properties["dataNumber"] = String(current);
      } else {
        // Non-numbered heading resets its counter AND all deeper levels
        // so that a new `##` section restarts any `###` numbered sequences
        for (const key of counters.keys()) {
          if (key >= level) {
            counters.delete(key);
          }
        }
      }
    });
  };
};

export default rehypeNumbered;
