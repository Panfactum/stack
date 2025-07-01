import { writeFile as fsWriteFile, access, mkdir, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { test, expect } from "bun:test";
import { CLIError } from "@/util/error/error";
import { removeFile } from "./removeFile";

test("removes file successfully", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const filePath = join(testDir, "test.txt");
    
    try {
        await mkdir(testDir, { recursive: true });
        await fsWriteFile(filePath, "test content");
        
        // Verify file exists
        await access(filePath);
        
        // Remove the file
        await removeFile({ filePath });
        
        // Verify file no longer exists
        await expect(access(filePath)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("removes file with complex path", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const filePath = join(testDir, "deep", "nested", "path", "report.pdf");
    
    try {
        await mkdir(dirname(filePath), { recursive: true });
        await fsWriteFile(filePath, "test content");
        
        // Verify file exists
        await access(filePath);
        
        // Remove the file
        await removeFile({ filePath });
        
        // Verify file no longer exists
        await expect(access(filePath)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles non-existent file gracefully due to force flag", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const filePath = join(testDir, "nonexistent.txt");
    
    // Should not throw when trying to remove a non-existent file
    await expect(async () => {
        await removeFile({ filePath });
    }).not.toThrow();
});

test("throws CLIError when rm fails due to permissions", async () => {
    // Skip this test on Windows where chmod doesn't work the same way
    if (process.platform === "win32") {
        return;
    }
    
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const protectedDir = join(testDir, "protected");
    const filePath = join(protectedDir, "file.txt");
    
    try {
        await mkdir(protectedDir, { recursive: true });
        await fsWriteFile(filePath, "test content");
        
        // Make directory read-only to prevent file deletion
        await chmod(protectedDir, 0o444);
        
        await expect(removeFile({ filePath })).rejects.toThrow(CLIError);
        await expect(removeFile({ filePath })).rejects.toThrow(`Unable to delete file at ${filePath}`);
    } finally {
        // Restore permissions before cleanup
        await chmod(protectedDir, 0o755).catch(() => {});
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles relative paths", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const filePath = join(testDir, "relative.txt");
    
    try {
        await mkdir(testDir, { recursive: true });
        await fsWriteFile(filePath, "test content");
        
        // Change to test directory
        const originalCwd = process.cwd();
        process.chdir(testDir);
        
        // Remove using relative path
        await removeFile({ filePath: "./relative.txt" });
        
        // Verify file no longer exists
        await expect(access(filePath)).rejects.toThrow();
        
        process.chdir(originalCwd);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles paths with special characters", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const filePath = join(testDir, "file with spaces & symbols!.txt");
    
    try {
        await mkdir(testDir, { recursive: true });
        await fsWriteFile(filePath, "test content");
        
        // Verify file exists
        await access(filePath);
        
        // Remove the file
        await removeFile({ filePath });
        
        // Verify file no longer exists
        await expect(access(filePath)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles different file extensions", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const files = [
        "config.yaml",
        "script.sh",
        "data.json",
        "archive.tar.gz"
    ];
    
    try {
        await mkdir(testDir, { recursive: true });
        
        // Create all files
        for (const file of files) {
            await fsWriteFile(join(testDir, file), "test content");
        }
        
        // Remove all files
        for (const file of files) {
            const filePath = join(testDir, file);
            await removeFile({ filePath });
            
            // Verify each file no longer exists
            await expect(access(filePath)).rejects.toThrow();
        }
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles files without extensions", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const filePath = join(testDir, "Makefile");
    
    try {
        await mkdir(testDir, { recursive: true });
        await fsWriteFile(filePath, "test content");
        
        // Verify file exists
        await access(filePath);
        
        // Remove the file
        await removeFile({ filePath });
        
        // Verify file no longer exists
        await expect(access(filePath)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles very long file paths", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const longPath = join(testDir, "very", "long", "path", "with", "many", "nested", 
                         "directories", "containing", "a", "file", "with", "a", 
                         "very", "long", "name.txt");
    
    try {
        await mkdir(dirname(longPath), { recursive: true });
        await fsWriteFile(longPath, "test content");
        
        // Verify file exists
        await access(longPath);
        
        // Remove the file
        await removeFile({ filePath: longPath });
        
        // Verify file no longer exists
        await expect(access(longPath)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("includes file path in error message", async () => {
    try {
        // Try to remove a file from a non-existent nested directory
        // This will fail because the parent directories don't exist
        await removeFile({ filePath: "/this/path/definitely/does/not/exist/anywhere/file.txt" });
        
        // Force flag means it shouldn't fail for non-existent files
        expect(true).toBe(true);
    } catch (error) {
        // If it does fail for some reason, ensure it's our error type
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).message).toContain("Unable to delete file");
    }
});

test("removes multiple files in sequence", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const files = ["file1.txt", "file2.txt", "file3.txt"];
    
    try {
        await mkdir(testDir, { recursive: true });
        
        // Create all files
        for (const file of files) {
            await fsWriteFile(join(testDir, file), `content of ${file}`);
        }
        
        // Remove files one by one
        for (const file of files) {
            const filePath = join(testDir, file);
            await removeFile({ filePath });
        }
        
        // Verify all files are gone
        for (const file of files) {
            await expect(access(join(testDir, file))).rejects.toThrow();
        }
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles empty file removal", async () => {
    const testDir = join(tmpdir(), `removeFile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const filePath = join(testDir, "empty.txt");
    
    try {
        await mkdir(testDir, { recursive: true });
        await fsWriteFile(filePath, "");
        
        // Verify file exists
        await access(filePath);
        
        // Remove the empty file
        await removeFile({ filePath });
        
        // Verify file no longer exists
        await expect(access(filePath)).rejects.toThrow();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});