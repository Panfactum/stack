import type { PanfactumContext } from "@/context/context";

export function getRelativeFromRoot(context: PanfactumContext, path: string) {
    return path.replace(new RegExp(`^${context.repoVariables.repo_root}/?`), '');
}