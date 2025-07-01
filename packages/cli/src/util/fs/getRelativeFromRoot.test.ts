import { test, expect } from "bun:test";
import { getRelativeFromRoot } from "./getRelativeFromRoot";
import type { PanfactumContext } from "@/util/context/context";

test("converts absolute path to relative path", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/home/user/project"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/home/user/project/src/components/Button.tsx"
    });

    expect(result).toBe("src/components/Button.tsx");
});

test("handles repo root with trailing slash", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/home/user/project/"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/home/user/project/src/utils/helper.ts"
    });

    expect(result).toBe("src/utils/helper.ts");
});

test("handles path exactly matching repo root", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/home/user/project"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/home/user/project"
    });

    expect(result).toBe("");
});

test("handles path exactly matching repo root with trailing slash", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/home/user/project"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/home/user/project/"
    });

    expect(result).toBe("");
});

test("handles nested directory structures", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/workspace/panfactum"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/workspace/panfactum/packages/cli/src/util/fs/getRelativeFromRoot.ts"
    });

    expect(result).toBe("packages/cli/src/util/fs/getRelativeFromRoot.ts");
});

test("handles paths with special characters", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/home/user/my project"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/home/user/my project/src/files/@special-file!.txt"
    });

    expect(result).toBe("src/files/@special-file!.txt");
});

test("handles paths outside repo root (returns original path)", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/home/user/project"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/home/test/1/file.txt"
    });

    expect(result).toBe("../../test/1/file.txt");
});

test("handles complex repo root paths", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/opt/projects/company/panfactum-stack"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/opt/projects/company/panfactum-stack/infrastructure/aws/modules/vpc/main.tf"
    });

    expect(result).toBe("infrastructure/aws/modules/vpc/main.tf");
});

test("handles repo root that is a substring of another path", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/home/user/project"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/home/user/project-backup/file.txt"
    });
    expect(result).toBe("../project-backup/file.txt");
});

test("handles single character file names", () => {
    const mockContext = {
        repoVariables: {
            repo_root: "/repo"
        }
    } as PanfactumContext;

    const result = getRelativeFromRoot({
        context: mockContext,
        path: "/repo/a"
    });

    expect(result).toBe("a");
});