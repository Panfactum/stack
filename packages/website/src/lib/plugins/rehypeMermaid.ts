// Rehype plugin that renders mermaid code blocks to inline SVGs
// using isomorphic-mermaid (no browser/Playwright required).

import type { Element, Root } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

interface RehypeMermaidOptions {
  mermaidConfig?: Record<string, unknown>;
}

interface MermaidDiagram {
  /** Index of the <pre> node within its parent's children array */
  index: number;
  /** The parent node that contains the <pre> element */
  parent: Element | Root;
  /** The raw mermaid diagram source text */
  source: string;
}

// Vite statically transforms all import() expressions to route them through
// its SSR module runner. During dev-mode content processing the runner may
// already be closed, causing "Vite module runner has been closed" errors.
// Constructing the import call at runtime hides it from Vite's static
// analysis so it falls through to Node.js's native module loader.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const nativeImport = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<Record<string, unknown>>;

/**
 * Determines whether a HAST element is a mermaid code block,
 * i.e. `<pre><code class="language-mermaid">`.
 */
const isMermaidPreNode = (node: Element): boolean => {
  if (node.tagName !== "pre") return false;
  const codeChild = node.children.find(
    (child): child is Element =>
      child.type === "element" && child.tagName === "code",
  );
  if (!codeChild) return false;

  // eslint-disable-next-line better-tailwindcss/no-unregistered-classes
  const className = codeChild.properties["className"];
  if (!Array.isArray(className)) return false;
  return className.some(
    (cls) => typeof cls === "string" && cls === "language-mermaid",
  );
};

const rehypeMermaid: Plugin<[RehypeMermaidOptions?], Root> = (options = {}) => {
  const { mermaidConfig } = options;

  return async (tree: Root) => {
    // Collect all mermaid diagrams first since we can't await inside visit.
    const diagrams: MermaidDiagram[] = [];

    visit(tree, "element", (node, index, parent) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (index === undefined || index === null || !parent || !isMermaidPreNode(node)) {
        return;
      }

      diagrams.push({
        index,
        parent,
        source: hastToString(node),
      });
    });

    if (diagrams.length === 0) return;

    const mermaidModule = (await nativeImport("isomorphic-mermaid")) as {
      default: {
        initialize: (config: Record<string, unknown>) => void;
        render: (
          id: string,
          text: string,
        ) => Promise<{ svg: string }>;
      };
    };
    const fromHtmlModule = (await nativeImport(
      "hast-util-from-html-isomorphic",
    )) as {
      fromHtmlIsomorphic: (
        value: string,
        options?: { fragment?: boolean },
      ) => Root;
    };

    const mermaid = mermaidModule.default;
    const { fromHtmlIsomorphic } = fromHtmlModule;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false,
      ...mermaidConfig,
    });

    // Render each diagram and replace the <pre> node with the SVG.
    // Process in reverse index order so that earlier indices remain valid
    // when we splice into the parent's children array.
    for (const diagram of diagrams.reverse()) {
      const diagramId = `mermaid-${diagram.index}`;
      const { svg } = await mermaid.render(diagramId, diagram.source);

      const svgTree = fromHtmlIsomorphic(svg, { fragment: true });
      const svgElement = svgTree.children[0];

      if (svgElement) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition
        diagram.parent.children.splice(
          diagram.index,
          1,
          svgElement as Element,
        );
      }
    }
  };
};

export default rehypeMermaid;
