import { mkdir, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, describe } from "bun:test";
import { createTestDir } from "@/util/test/createTestDir";
import { removeDirectory } from "./removeDirectory";

describe("removeDirectory", () => {
  test("removes directory successfully", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    const targetDir = join(testDir, "target");
    
    try {
        await mkdir(targetDir, { recursive: true });
        
        // Verify directory exists
        await access(targetDir);
        
        // Remove it
        await removeDirectory({ dirPath: targetDir });
        
        // Verify directory no longer exists
        await expect(access(targetDir)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("removes nested directory successfully", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    const nestedDir = join(testDir, "nested", "deep", "directory");
    
    try {
        await mkdir(nestedDir, { recursive: true });
        
        // Verify directory exists
        await access(nestedDir);
        
        // Remove it
        await removeDirectory({ dirPath: nestedDir });
        
        // Verify directory no longer exists
        await expect(access(nestedDir)).rejects.toThrow();
        
        // Parent directories should still exist
        await access(join(testDir, "nested", "deep"));
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles non-existent directory gracefully due to force flag", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    const nonExistentDir = join(testDir, "nonexistent");
    
    try {
        
        // Should not throw when removing non-existent directory
        await removeDirectory({ dirPath: nonExistentDir });
        
        // Verify it still doesn't exist
        await expect(access(nonExistentDir)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles relative paths", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    const originalCwd = process.cwd();
    
    try {
        await mkdir(join(testDir, "relative", "directory"), { recursive: true });
        process.chdir(testDir);
        
        // Verify directory exists
        await access("./relative/directory");
        
        // Remove using relative path
        await removeDirectory({ dirPath: "./relative/directory" });
        
        // Verify directory no longer exists
        await expect(access("./relative/directory")).rejects.toThrow();
    } finally {
        process.chdir(originalCwd);
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles paths with special characters", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    const specialPath = join(testDir, "dir with spaces & symbols!");
    
    try {
        await mkdir(specialPath, { recursive: true });
        
        // Verify directory exists
        await access(specialPath);
        
        // Remove it
        await removeDirectory({ dirPath: specialPath });
        
        // Verify directory no longer exists
        await expect(access(specialPath)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("removes directory with contents", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    const dirWithFiles = join(testDir, "directory-with-files");
    
    try {
        // Create directory with various contents
        await mkdir(join(dirWithFiles, "subdir1", "subdir2"), { recursive: true });
        await mkdir(join(dirWithFiles, "subdir3"), { recursive: true });
        await writeFile(join(dirWithFiles, "file1.txt"), "content1");
        await writeFile(join(dirWithFiles, "file2.txt"), "content2");
        await writeFile(join(dirWithFiles, "subdir1", "file3.txt"), "content3");
        await writeFile(join(dirWithFiles, "subdir1", "subdir2", "file4.txt"), "content4");
        
        // Verify directory and contents exist
        await access(dirWithFiles);
        await access(join(dirWithFiles, "file1.txt"));
        await access(join(dirWithFiles, "subdir1", "subdir2", "file4.txt"));
        
        // Remove entire directory tree
        await removeDirectory({ dirPath: dirWithFiles });
        
        // Verify everything is gone
        await expect(access(dirWithFiles)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles very long paths", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    const longPath = join(
        testDir,
        "very", "long", "path", "with", "many", "nested", 
        "directories", "that", "goes", "very", "deep", "into", 
        "the", "filesystem", "structure", "to", "test", "limits"
    );
    
    try {
        await mkdir(longPath, { recursive: true });
        
        // Verify directory exists
        await access(longPath);
        
        // Remove it
        await removeDirectory({ dirPath: longPath });
        
        // Verify directory no longer exists
        await expect(access(longPath)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("removes directory with hidden files", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    const dirWithHidden = join(testDir, "with-hidden");
    
    try {
        await mkdir(dirWithHidden, { recursive: true });
        await writeFile(join(dirWithHidden, ".hidden"), "hidden content");
        await writeFile(join(dirWithHidden, "visible.txt"), "visible content");
        await mkdir(join(dirWithHidden, ".hiddenDir"), { recursive: true });
        await writeFile(join(dirWithHidden, ".hiddenDir", "file.txt"), "nested hidden");
        
        // Remove directory
        await removeDirectory({ dirPath: dirWithHidden });
        
        // Verify everything is gone
        await expect(access(dirWithHidden)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles empty directories", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    const emptyDir = join(testDir, "empty");
    
    try {
        await mkdir(emptyDir, { recursive: true });
        
        // Verify directory exists and is empty
        await access(emptyDir);
        
        // Remove it
        await removeDirectory({ dirPath: emptyDir });
        
        // Verify directory no longer exists
        await expect(access(emptyDir)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("removes multiple directories in sequence", async () => {
    const { path: testDir } = await createTestDir({ functionName: "removeDirectory" });
    
    try {
        // Create multiple directories
        const dirs = [
            join(testDir, "dir1"),
            join(testDir, "dir2"),
            join(testDir, "dir3", "nested")
        ];
        
        for (const dir of dirs) {
            await mkdir(dir, { recursive: true });
            await writeFile(join(dir, "file.txt"), "content");
        }
        
        // Remove them all
        for (const dir of dirs) {
            await removeDirectory({ dirPath: dir });
            await expect(access(dir)).rejects.toThrow();
        }
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});
});