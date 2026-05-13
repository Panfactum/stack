
import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import YAML from "yaml";

import fs from "node:fs";
import path from "node:path";

interface TermData {
  term: string;
  summary: string;
}

// Cache: version -> (termId -> TermData)
const glossaryCache = new Map<string, Map<string, TermData>>();

function toSlug(term: string) {
  return term.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

function loadGlossary(version: string): Map<string, TermData> {
  const cached = glossaryCache.get(version);
  if (cached) return cached;

  const termsDir = path.resolve(
    "src/content/docs",
    version,
    "reference/glossary/_terms",
  );

  const terms = new Map<string, TermData>();

  if (fs.existsSync(termsDir)) {
    for (const file of fs.readdirSync(termsDir)) {
      if (!file.endsWith(".yaml")) continue;
      const id = file.replace(/\.yaml$/, "");
      const content = fs.readFileSync(path.join(termsDir, file), "utf-8");
      const data = YAML.parse(content) as TermData;
      terms.set(id, data);
    }
  }

  glossaryCache.set(version, terms);
  return terms;
}

/**
 * Rehype plugin that enriches `<span data-term-id="...">` elements
 * (created by remarkTerm) with glossary term data for client-side popovers.
 */
const rehypeTermPopover: Plugin<[], Root> = () => {
  return (tree: Root, vfile) => {
    // Extract docs version from the file path
    const filePath = vfile.history[0] ?? "";
    const versionMatch = filePath.match(/src\/content\/docs\/([^/]+)\//);
    const version = versionMatch?.[1] ?? "main";

    let terms = loadGlossary(version);

    // Fall back to main if the version has no glossary
    if (terms.size === 0 && version !== "main") {
      terms = loadGlossary("main");
    }

    visit(tree, "element", (node: Element) => {
      const termId = node.properties["dataTermId"] as string | undefined;
      if (!termId) return;

      const termData = terms.get(termId);
      if (!termData) {
        throw new Error(
          `Unknown glossary term "${termId}" in ${filePath}. ` +
            `No matching file found at reference/glossary/_terms/${termId}.yaml`,
        );
      }

      const slug = toSlug(termData.term);
      const encoded = Buffer.from(termData.summary, "utf-8").toString(
        "base64",
      );

      node.properties["dataTermContent"] = encoded;
      node.properties["dataTermTitle"] = termData.term;
      node.properties["dataTermLink"] = `/docs/${version}/reference/glossary#${slug}`;
      node.properties["tabIndex"] = 0;
      node.properties["role"] = "button";
    });
  };
};

export default rehypeTermPopover;
