// Shared Mermaid configuration and rendering utility.
// Used by rehypeMermaid (MDX pipeline) and GlossaryTerms (marked pipeline).

import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

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

// Mermaid renders SVGs at build time in Node.js, so CSS var()
// references cannot be used here. Values must be hex literals
// that match the Tailwind @theme tokens in global.css.
const MERMAID_CONFIG: Record<string, unknown> = {
  startOnLoad: false,
  securityLevel: "strict",
  htmlLabels: false,
  theme: "dark",
  flowchart: {
    subGraphTitleMargin: { top: 10, bottom: 15 },
    rankSpacing: 30,
    nodeSpacing: 20,
  },
  themeVariables: {
    darkMode: true,
    background: "#0c111d",         // gray-dark-mode-950
    primaryColor: "#1a3b50",       // brand-750
    primaryTextColor: "#f5f5f6",   // gray-dark-mode-50
    primaryBorderColor: "#333741", // gray-dark-mode-700
    secondaryColor: "#1f242f",     // gray-dark-mode-800
    secondaryTextColor: "#cecfd2", // gray-dark-mode-300
    lineColor: "#70bfeb",          // brand-300
    textColor: "#f5f5f6",          // gray-dark-mode-50
    mainBkg: "#1a3b50",            // brand-750
    nodeBorder: "#333741",         // gray-dark-mode-700
    clusterBkg: "#161b26",         // gray-dark-mode-900
    clusterBorder: "#333741",      // gray-dark-mode-700
    titleColor: "#f5f5f6",         // gray-dark-mode-50
    edgeLabelBackground: "#1f242f", // gray-dark-mode-800
    fontFamily: '"Inter", sans-serif',
  },
};

interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
}

let instance: MermaidApi | null = null;

async function getInstance(): Promise<MermaidApi> {
  if (instance) return instance;

  const mod = (await nativeImport("isomorphic-mermaid")) as {
    default: MermaidApi;
  };
  instance = mod.default;
  instance.initialize(MERMAID_CONFIG);
  return instance;
}

// ---------------------------------------------------------------------------
// SVG post-processing: fix node rect heights for multi-line text
//
// With htmlLabels:false, Mermaid calculates rect height based on single-line
// text metrics and doesn't add sufficient height for additional lines. This
// causes text to overflow the bottom of its node rect. We fix this by walking
// the HAST tree, counting "text-outer-tspan row" elements per node, and
// increasing the rect height by one line-height per extra row.
// ---------------------------------------------------------------------------
const LINE_HEIGHT_EM = "1.4em"; // increased from mermaid's default 1.1em
const LINE_HEIGHT = 22; // ~1.4em at 16px base font

function hasClass(node: Element, cls: string): boolean {
  const className = node.properties["className"];
  if (typeof className === "string") return className.split(/\s+/).includes(cls);
  if (Array.isArray(className))
    return className.some((c) => typeof c === "string" && c.split(/\s+/).includes(cls));
  return false;
}

function countTextRows(node: Element): number {
  let count = 0;
  visit(node, "element", (child: Element) => {
    if (child.tagName === "tspan" && hasClass(child, "row")) {
      count++;
    }
  });
  return count;
}

/**
 * Returns the translate(x, y) from a node's transform attribute.
 */
function _getTranslate(node: Element): { x: number; y: number } {
  const transform = String(node.properties["transform"] ?? "");
  const match = transform.match(
    /translate\(\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*\)/,
  );
  return match
    ? { x: parseFloat(match[1]), y: parseFloat(match[2]) }
    : { x: 0, y: 0 };
}

// Empirical text metrics from mermaid's SVG output (htmlLabels:false, 16px font).
// TEXT_BBOX_TOP is where the rendered text BBox starts in the node's local coords.
// SINGLE_LINE_TEXT_HEIGHT is the BBox height of one line of text.
const TEXT_BBOX_TOP = 1;
const SINGLE_LINE_TEXT_HEIGHT = 19;

function fixNodePadding(tree: Root): void {
  // Center multi-line text vertically within its node rect.
  // Mermaid positions text starting at a fixed Y and growing downward,
  // so multi-line text overflows the bottom of the rect. Rather than
  // expanding rects (which breaks inter-node spacing), we shift the
  // text upward so its visual center matches the single-line position.
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "g" || !hasClass(node, "node")) return;

    const rows = countTextRows(node);
    if (rows <= 1) return;

    const singleLineCenter = TEXT_BBOX_TOP + SINGLE_LINE_TEXT_HEIGHT / 2;
    const textHeight = SINGLE_LINE_TEXT_HEIGHT + (rows - 1) * LINE_HEIGHT;
    const textCenter = TEXT_BBOX_TOP + textHeight / 2;
    const textShift = singleLineCenter - textCenter;

    // Increase line spacing on non-first rows and shift text to center it.
    let rowIdx = 0;
    visit(node, "element", (child: Element) => {
      if (child.tagName === "tspan" && hasClass(child, "row")) {
        if (rowIdx > 0) {
          child.properties["dy"] = LINE_HEIGHT_EM;
        }
        rowIdx++;
      }
      if (child.tagName === "text") {
        const existingTransform = String(child.properties["transform"] ?? "");
        child.properties["transform"] =
          `translate(0, ${textShift})${existingTransform ? " " + existingTransform : ""}`;
      }
    });
  });
}

async function postProcessSvg(svg: string): Promise<string> {
  const { fromHtmlIsomorphic } = (await nativeImport(
    "hast-util-from-html-isomorphic",
  )) as {
    fromHtmlIsomorphic: (
      value: string,
      options?: { fragment?: boolean },
    ) => Root;
  };
  const { toHtml } = (await nativeImport("hast-util-to-html")) as {
    toHtml: (tree: Root, options?: { space?: string }) => string;
  };

  const tree = fromHtmlIsomorphic(svg, { fragment: true });
  fixNodePadding(tree);
  return toHtml(tree, { space: "svg" });
}

/**
 * Renders a Mermaid diagram source string to an inline SVG string.
 */
export async function renderMermaidToSvg(
  id: string,
  source: string,
): Promise<string> {
  const mermaid = await getInstance();
  const { svg } = await mermaid.render(id, source);
  return postProcessSvg(svg);
}

/**
 * Finds ```mermaid code blocks in HTML (e.g. from marked.parse()) and
 * replaces them with rendered SVGs.
 */
export async function renderMermaidInHtml(
  html: string,
  idPrefix: string,
): Promise<string> {
  const mermaidBlockRegex =
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;
  const matches = [...html.matchAll(mermaidBlockRegex)];
  if (matches.length === 0) return html;

  let result = html;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const source = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    const svg = await renderMermaidToSvg(`${idPrefix}-${i}`, source);
    result =
      result.slice(0, match.index) +
      svg +
      result.slice(match.index + match[0].length);
  }

  return result;
}
