import type { Element, ElementContent, Root } from "hast";
import { toHtml } from "hast-util-to-html";
import type { Plugin } from "unified";
import { SKIP, visit } from "unist-util-visit";

/**
 * Rehype plugin that converts GFM footnotes into inline popover triggers.
 *
 * Pass 1: Collects footnote definitions from the bottom-of-page `<section>`
 *   (created by remark-gfm), serializes each definition's content to HTML,
 *   and removes the section from the tree.
 *
 * Pass 2: Replaces each inline `<sup>` footnote reference with a `<button>`
 *   that carries the definition as a base64-encoded `data-footnote-content`
 *   attribute. A companion client-side script reads this attribute and renders
 *   a popover on click.
 */
const rehypeFootnotePopover: Plugin<[], Root> = () => {
  return (tree: Root) => {
    const definitions = new Map<string, { html: string; readMoreHref?: string }>();

    // ── Pass 1: collect definitions & remove the footnotes section ──
    visit(tree, "element", (node, index, parent) => {
      if (
        index === undefined ||
        !parent ||
        node.tagName !== "section" ||
        !("dataFootnotes" in node.properties)
      ) {
        return;
      }

      // Find the <ol> containing footnote <li> items
      for (const child of node.children) {
        if (
          child.type === "element" &&
          child.tagName === "ol"
        ) {
          for (const li of child.children) {
            if (li.type !== "element" || li.tagName !== "li") continue;

            const id = li.properties["id"] as string | undefined;
            if (!id) continue;

            // Strip backref <a> elements (those linking back up to the ref)
            const contentChildren = filterBackrefs(li.children);

            // Check if the last element node is a <p> containing only a
            // single <a> (the "Read more" link convention). We search
            // backwards because trailing whitespace text nodes ("\n") may
            // follow the final <p>.
            let readMoreHref: string | undefined;
            for (let i = contentChildren.length - 1; i >= 0; i--) {
              const child = contentChildren[i];
              if (child.type !== "element") continue;
              if (isReadMoreParagraph(child)) {
                contentChildren.splice(i);
                const anchor = child.children.find(
                  (c): c is Element => c.type === "element" && c.tagName === "a",
                );
                if (anchor) {
                  readMoreHref = anchor.properties["href"] as string;
                }
              }
              break;
            }

            const html = toHtml({ type: "root", children: contentChildren });
            definitions.set(id, { html, readMoreHref });
          }
        }
      }

      // Remove the entire footnotes section
      parent.children.splice(index, 1);
      return [SKIP, index];
    });

    if (definitions.size === 0) return;

    // ── Pass 2: replace inline references with popover triggers ──
    visit(tree, "element", (node, index, parent) => {
      if (
        index === undefined ||
        !parent ||
        node.tagName !== "sup"
      ) {
        return;
      }

      // Find the <a> inside the <sup> that links to a footnote
      const anchor = node.children.find(
        (c): c is Element =>
          c.type === "element" &&
          c.tagName === "a" &&
          typeof c.properties["href"] === "string" &&
          (c.properties["href"]).startsWith("#user-content-fn-"),
      );
      if (!anchor) return;

      const href = anchor.properties["href"] as string;
      // href is like "#user-content-fn-1" — the definition id is "user-content-fn-1"
      const fnId = href.slice(1);
      const def = definitions.get(fnId);
      if (!def) return;

      const encoded = Buffer.from(def.html, "utf-8").toString("base64");

      // Extract the visible label (usually the footnote number)
      const label =
        anchor.children
          .filter((c) => c.type === "text")
          .map((c) => c.value)
          .join("") || "?";

      const buttonProps: Record<string, string> = {
          className: "footnote-popover-trigger",
          "dataFootnoteContent": encoded,
          "ariaLabel": `Footnote ${label}`,
          type: "button",
      };
      if (def.readMoreHref) {
        buttonProps["dataFootnoteReadMore"] = def.readMoreHref;
      }

      const button: Element = {
        type: "element",
        tagName: "button",
        properties: buttonProps,
        children: [{ type: "text", value: "?" }],
      };

      parent.children[index] = button;
      return [SKIP, index + 1];
    });
  };
};

/**
 * Check if a node is a `<p>` containing only a single `<a>` child
 * (ignoring whitespace-only text nodes). This is the "Read more" convention.
 */
function isReadMoreParagraph(node: ElementContent): boolean {
  if (node.type !== "element" || node.tagName !== "p") return false;
  const meaningful = node.children.filter(
    (c) => !(c.type === "text" && c.value.trim() === ""),
  );
  return (
    meaningful.length === 1 &&
    meaningful[0].type === "element" &&
    meaningful[0].tagName === "a" &&
    typeof meaningful[0].properties["href"] === "string"
  );
}

/**
 * Filter out backref `<a>` elements from footnote definition children.
 * These are the "↩" links that remark-gfm adds to jump back to the reference.
 */
function filterBackrefs(children: ElementContent[]): ElementContent[] {
  return children.reduce<ElementContent[]>((acc, child) => {
    if (child.type === "element") {
      // Backref anchors have dataFootnoteBackref property (value is empty string)
      if ("dataFootnoteBackref" in child.properties) {
        return acc;
      }
      // Recurse into child elements to strip nested backrefs
      const filtered: Element = {
        ...child,
        children: filterBackrefs(child.children),
      };
      acc.push(filtered);
    } else {
      acc.push(child);
    }
    return acc;
  }, []);
}

export default rehypeFootnotePopover;
