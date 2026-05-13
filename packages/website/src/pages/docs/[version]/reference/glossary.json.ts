import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";

import { DOCS_VERSIONS } from "@/lib/constants";

export const getStaticPaths: GetStaticPaths = () => {
  return DOCS_VERSIONS.map((v) => ({ params: { version: v.slug } }));
};

export const GET: APIRoute = async ({ params }) => {
  const version = params.version ?? "";
  const allTerms = await getCollection("glossaryTerms");
  const terms = allTerms
    .filter((t) => t.id.startsWith(`${version}/reference/glossary/_terms/`))
    .sort((a, b) => a.data.term.localeCompare(b.data.term))
    .map((t) => ({
      term: t.data.term,
      summary: t.data.summary,
    }));

  return new Response(JSON.stringify(terms, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};
