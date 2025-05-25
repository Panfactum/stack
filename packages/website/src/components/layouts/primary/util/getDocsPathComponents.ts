import { isValidVersion } from "./isValidVersion.ts";

// Returns the documentation path with the /docs prefix and the version (if applicable)
export function getDocsPathComponents(fullPath: string) {
  const [_, maybeVersion, ...pathArr] = fullPath.split("/");

  if (isValidVersion(maybeVersion)) {
    return {
      nonVersionedPath: pathArr.join("/"),
      version: maybeVersion,
    };
  } else {
    return {
      nonVersionedPath: [maybeVersion, ...pathArr].join("/"),
      version: null,
    };
  }
}
