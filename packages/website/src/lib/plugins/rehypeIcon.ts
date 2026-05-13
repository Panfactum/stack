import type { Element, ElementContent, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

import fs from "node:fs";
import path from "node:path";

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

// Cache parsed SVG HAST trees by icon name so we only read + parse each file once.
const svgCache = new Map<string, Element>();

// Vite statically transforms all import() expressions to route them through
// its SSR module runner. Constructing the import call at runtime hides it
// from Vite's static analysis so it falls through to Node.js's native loader.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const nativeImport = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<Record<string, unknown>>;

interface IconHeading {
  node: Element;
  iconName: string;
}

/**
 * Deep-clone a HAST element tree so each insertion gets its own copy
 * and shared references don't cause issues.
 */
function cloneElement(el: Element): Element {
  return {
    type: el.type,
    tagName: el.tagName,
    properties: { ...el.properties },
    children: el.children.map((child) => {
      if (child.type === "element") {
        return cloneElement(child);
      }
      return { ...child };
    }) as ElementContent[],
  };
}

/**
 * Rehype plugin that transforms headings marked with `data-icon`
 * (set by remarkIcon) into headings with an inline SVG icon prepended.
 *
 * Reads SVG files from `src/assets/heading-icons/{name}.svg` at build time,
 * parses them into HAST, and inserts a `<span class="heading-icon">` wrapper
 * before the heading text. Adds an `icon-heading` class to the heading element.
 *
 * Throws a build error if the referenced SVG file doesn't exist.
 */
const rehypeIcon: Plugin<[], Root> = () => {
  return async (tree: Root) => {
    const headings: IconHeading[] = [];

    visit(tree, "element", (node) => {
      if (!HEADING_TAGS.has(node.tagName)) return;
      const iconName = node.properties["dataIcon"];
      if (typeof iconName !== "string") return;
      headings.push({ node, iconName });
    });

    if (headings.length === 0) return;

    const fromHtmlModule = (await nativeImport(
      "hast-util-from-html-isomorphic",
    )) as {
      fromHtmlIsomorphic: (
        value: string,
        options?: { fragment?: boolean },
      ) => Root;
    };
    const { fromHtmlIsomorphic } = fromHtmlModule;

    const iconsDir = path.resolve("src/assets/heading-icons");

    for (const { node, iconName } of headings) {
      // Load and cache the SVG
      if (!svgCache.has(iconName)) {
        const svgPath = path.join(iconsDir, `${iconName}.svg`);
        if (!fs.existsSync(svgPath)) {
          throw new Error(
            `[rehypeIcon] SVG file not found for icon "${iconName}": ${svgPath}`,
          );
        }
        const svgString = fs.readFileSync(svgPath, "utf-8");
        const svgTree = fromHtmlIsomorphic(svgString, { fragment: true });
        const svgElement = svgTree.children.find(
          (c): c is Element => c.type === "element" && c.tagName === "svg",
        );
        if (!svgElement) {
          throw new Error(
            `[rehypeIcon] No <svg> element found in file: ${svgPath}`,
          );
        }

        // Strip width/height so CSS controls sizing; add aria-hidden
        delete svgElement.properties["width"];
        delete svgElement.properties["height"];
        svgElement.properties["ariaHidden"] = "true";

        svgCache.set(iconName, svgElement);
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guaranteed by the cache-fill block above
      const cached = svgCache.get(iconName)!;
      const level = node.tagName[1]; // "1"–"6"

      // Create a wrapper span with level-specific class
      const wrapper: Element = {
        type: "element",
        tagName: "span",
        properties: {
          className: [`heading-icon`, `heading-icon-h${level}`],
        },
        children: [cloneElement(cached)],
      };

      // Prepend the icon wrapper to the heading's children
      node.children.unshift(wrapper);

      // Add `icon-heading` class to the heading
      const existing = (node.properties.className ?? []) as string[];
      node.properties.className = [...existing, "icon-heading"];

      // Remove the marker property from the rendered output
      delete node.properties["dataIcon"];
    }
  };
};

export default rehypeIcon;
