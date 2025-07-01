import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "bun:test";
import { findFolder } from "./findFolder";

// Helper to create a test directory structure
async function createTestStructure(basePath: string) {
    // Create directories
    await mkdir(join(basePath, "visible"), { recursive: true });
    await mkdir(join(basePath, ".hidden"), { recursive: true });
    await mkdir(join(basePath, "level1", "level2"), { recursive: true });
    await mkdir(join(basePath, "src"), { recursive: true });
    await mkdir(join(basePath, "docs"), { recursive: true });

    // Create some files
    await writeFile(join(basePath, "file.txt"), "test");
    await writeFile(join(basePath, "README.md"), "test");
    await writeFile(join(basePath, "src", "index.js"), "test");
}

test("returns folder path when found in current directory", async () => {
    const testDir = join(tmpdir(), `findFolder-test-${Date.now()}-1`);
    try {
        await mkdir(testDir, { recursive: true });
        await mkdir(join(testDir, "targetFolder"), { recursive: true });

        const result = await findFolder(testDir, "targetFolder");

        expect(result).toBe(join(testDir, "targetFolder"));
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("returns folder path when found in subdirectory", async () => {
    const testDir = join(tmpdir(), `findFolder-test-${Date.now()}-2`);
    try {
        await mkdir(testDir, { recursive: true });
        await mkdir(join(testDir, "subdir"), { recursive: true });
        await mkdir(join(testDir, "subdir", "targetFolder"), { recursive: true });

        const result = await findFolder(testDir, "targetFolder");

        expect(result).toBe(join(testDir, "subdir", "targetFolder"));
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("returns null when folder is not found", async () => {
    const testDir = join(tmpdir(), `findFolder-test-${Date.now()}-3`);
    try {
        await createTestStructure(testDir);

        const result = await findFolder(testDir, "nonexistent");

        expect(result).toBe(null);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("skips hidden directories", async () => {
    const testDir = join(tmpdir(), `findFolder-test-${Date.now()}-4`);
    try {
        await mkdir(testDir, { recursive: true });
        await mkdir(join(testDir, ".hidden"), { recursive: true });
        await mkdir(join(testDir, ".hidden", "targetFolder"), { recursive: true });
        await mkdir(join(testDir, "visible"), { recursive: true });

        // The target is only in the hidden directory, so it shouldn't be found
        const result = await findFolder(testDir, "targetFolder");

        expect(result).toBe(null);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("recursively searches nested directories", async () => {
    const testDir = join(tmpdir(), `findFolder-test-${Date.now()}-5`);
    try {
        await mkdir(testDir, { recursive: true });
        await mkdir(join(testDir, "level1", "level2"), { recursive: true });
        await mkdir(join(testDir, "level1", "level2", "targetFolder"), { recursive: true });

        const result = await findFolder(testDir, "targetFolder");

        expect(result).toBe(join(testDir, "level1", "level2", "targetFolder"));
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles empty directories", async () => {
    const testDir = join(tmpdir(), `findFolder-test-${Date.now()}-6`);
    try {
        await mkdir(testDir, { recursive: true });

        const result = await findFolder(testDir, "target");

        expect(result).toBe(null);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("stops at first match found", async () => {
    const testDir = join(tmpdir(), `findFolder-test-${Date.now()}-7`);
    try {
        await mkdir(testDir, { recursive: true });
        await mkdir(join(testDir, "dir1"), { recursive: true });
        await mkdir(join(testDir, "dir1", "targetFolder"), { recursive: true });
        await mkdir(join(testDir, "dir2"), { recursive: true });
        await mkdir(join(testDir, "dir2", "targetFolder"), { recursive: true });

        const result = await findFolder(testDir, "targetFolder");

        // Should find one of them - the order depends on the filesystem
        expect(result).toMatch(/\/(dir1|dir2)\/targetFolder$/);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles mixed files and directories", async () => {
    const testDir = join(tmpdir(), `findFolder-test-${Date.now()}-8`);
    try {
        await createTestStructure(testDir);
        await mkdir(join(testDir, "docs", "targetFolder"), { recursive: true });

        const result = await findFolder(testDir, "targetFolder");

        expect(result).toBe(join(testDir, "docs", "targetFolder"));
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("finds hidden folders when specifically searched for", async () => {
    const testDir = join(tmpdir(), `findFolder-test-${Date.now()}-9`);
    try {
        await mkdir(testDir, { recursive: true });
        await mkdir(join(testDir, ".panfactum"), { recursive: true });

        // When searching for a hidden folder by name, it should be found at the top level
        const result = await findFolder(testDir, ".panfactum");

        expect(result).toBe(join(testDir, ".panfactum"));
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});