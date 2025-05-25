import { DOCS_VERSIONS } from "@/lib/constants";

export function isValidVersion(version: string) {
  return DOCS_VERSIONS.find(v => v.slug === version);
}
