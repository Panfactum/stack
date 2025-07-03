import { access, rm, stat, chmod } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, describe } from "bun:test";
import { CLIError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";
import { createDirectory } from "./createDirectory";

describe("createDirectory", () => {
  test("creates directory successfully", async () => {
    const { path: testDir } = await createTestDir({ functionName: "createDirectory" });
    const dirPath = join(testDir, "newdir");
    
    try {
        
        // Create the actual test directory
        await createDirectory({ dirPath });
        
        // Verify directory exists
        await access(dirPath);
        const stats = await stat(dirPath);
        expect(stats.isDirectory()).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("creates nested directory successfully", async () => {
    const { path: testDir } = await createTestDir({ functionName: "createDirectory" });
    const nestedPath = join(testDir, "level1", "level2", "level3", "deep");
    
    try {
        // Create nested directory structure
        await createDirectory({ dirPath: nestedPath });
        
        // Verify all directories were created
        await access(nestedPath);
        const stats = await stat(nestedPath);
        expect(stats.isDirectory()).toBe(true);
        
        // Verify intermediate directories exist
        await access(join(testDir, "level1"));
        await access(join(testDir, "level1", "level2"));
        await access(join(testDir, "level1", "level2", "level3"));
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("throws CLIError when mkdir fails", async () => {
    // Skip this test on Windows where permissions work differently
    if (process.platform === "win32") {
        return;
    }
    
    const { path: testDir } = await createTestDir({ functionName: "createDirectory" });
    const protectedDir = join(testDir, "protected");
    const targetDir = join(protectedDir, "cannotcreate");
    
    try {
        // Create protected directory
        await createDirectory({ dirPath: protectedDir });
        
        // Make directory read-only to prevent subdirectory creation
        await chmod(protectedDir, 0o444);
        
        // This should fail
        await expect(createDirectory({ dirPath: targetDir })).rejects.toThrow(CLIError);
        await expect(createDirectory({ dirPath: targetDir })).rejects.toThrow("Unable to create directory");
    } finally {
        // Restore permissions before cleanup
        await chmod(protectedDir, 0o755).catch(() => {});
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles relative paths", async () => {
    const { path: testDir } = await createTestDir({ functionName: "createDirectory" });
    const originalCwd = process.cwd();
    
    try {
        // Change to test directory
        process.chdir(testDir);
        
        // Create directory using relative path
        await createDirectory({ dirPath: "./relative/path" });
        
        // Verify it was created
        await access("./relative/path");
        const stats = await stat("./relative/path");
        expect(stats.isDirectory()).toBe(true);
        
        // Also check absolute path
        await access(join(testDir, "relative", "path"));
    } finally {
        process.chdir(originalCwd);
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles directory that already exists", async () => {
    const { path: testDir } = await createTestDir({ functionName: "createDirectory" });
    const dirPath = join(testDir, "existing");
    
    try {
        // Create directory first time
        await createDirectory({ dirPath });
        
        // Verify it exists
        await access(dirPath);
        
        // Create same directory again - should not throw
        await expect(async () => {
            await createDirectory({ dirPath });
        }).not.toThrow();
        
        // Directory should still exist
        await access(dirPath);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("creates directory with spaces and special characters", async () => {
    const { path: testDir } = await createTestDir({ functionName: "createDirectory" });
    const dirPath = join(testDir, "dir with spaces & symbols!");
    
    try {
        await createDirectory({ dirPath });
        
        // Verify directory exists
        await access(dirPath);
        const stats = await stat(dirPath);
        expect(stats.isDirectory()).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("creates very long path", async () => {
    const { path: testDir } = await createTestDir({ functionName: "createDirectory" });
    const longPath = join(
        testDir,
        "very", "long", "path", "with", "many", "nested",
        "directories", "to", "test", "deep", "nesting"
    );
    
    try {
        await createDirectory({ dirPath: longPath });
        
        // Verify directory exists
        await access(longPath);
        const stats = await stat(longPath);
        expect(stats.isDirectory()).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles empty directory path gracefully", async () => {
    // Empty path should throw an error
    await expect(createDirectory({ dirPath: "" })).rejects.toThrow();
});
});