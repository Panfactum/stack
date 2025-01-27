import { Versions } from "@/lib/constants.ts";

export function isValidVersion(version: string): version is Versions {
  return Object.values(Versions).includes(version as Versions);
}
