import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";

import { DOCS_VERSIONS } from "@/lib/constants";

function termToSlug(term: string): string {
  return term
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

export const getStaticPaths: GetStaticPaths = async () => {
  const allTerms = await getCollection("glossaryTerms");
  const paths = [];

  for (const version of DOCS_VERSIONS) {
    const versionTerms = allTerms.filter((t) =>
      t.id.startsWith(`${version.slug}/reference/glossary/_terms/`),
    );
    for (const t of versionTerms) {
      paths.push({
        params: { version: version.slug, term: termToSlug(t.data.term) },
        props: { term: t.data.term, summary: t.data.summary, description: t.data.description },
      });
    }
  }

  return paths;
};

interface Props {
  term: string;
  summary: string;
  description: string;
}

export const GET: APIRoute<Props> = ({ props, site }) => {
  const siteOrigin = site ? site.origin : "";

  const lines: string[] = [];
  lines.push(`# ${props.term}`);
  lines.push("");
  lines.push(`> ${props.summary}`);
  lines.push("");
  lines.push(props.description);

  const body = lines.join("\n").replace(/\]\(\//g, `](${siteOrigin}/`);

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
