// Tests for directoryExists utility function
// Verifies that directory existence checks work correctly with real filesystem operations

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, describe } from "bun:test";
import { createTestDir } from "@/util/test/createTestDir";
import { directoryExists } from "./directoryExists";

describe("directoryExists", () => {
    test("returns true if the directory exists", async () => {
        const { path: testDir } = await createTestDir({ functionName: "directoryExists" });

        try {
            // Test with the created directory itself
            const result = await directoryExists({ path: testDir });
            expect(result).toBe(true);

            // Test with a subdirectory
            const subDir = join(testDir, "subdirectory");
            await mkdir(subDir, { recursive: true });

            const subDirResult = await directoryExists({ path: subDir });
            expect(subDirResult).toBe(true);
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    test("returns false if the directory does not exist", async () => {
        const { path: testDir } = await createTestDir({ functionName: "directoryExists" });

        try {
            // Test with a non-existent directory
            const nonExistentDir = join(testDir, "non-existent");
            const result = await directoryExists({ path: nonExistentDir });
            expect(result).toBe(false);

            // Test with a completely non-existent path
            const result2 = await directoryExists({ path: "/completely/non/existent/path/12345" });
            expect(result2).toBe(false);
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    test("returns false for files (not directories)", async () => {
        const { path: testDir } = await createTestDir({ functionName: "directoryExists" });

        try {
            // Create a file
            const filePath = join(testDir, "test-file.txt");
            await writeFile(filePath, "test content");

            // directoryExists should return false for files
            const result = await directoryExists({ path: filePath });
            expect(result).toBe(false);
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    test("handles relative paths", async () => {
        const { path: testDir } = await createTestDir({ functionName: "directoryExists" });
        const originalCwd = process.cwd();

        try {
            // Create a subdirectory
            const subDir = join(testDir, "subdir");
            await mkdir(subDir, { recursive: true });

            // Change to test directory
            process.chdir(testDir);

            // Test with relative path
            const result = await directoryExists({ path: "./subdir" });
            expect(result).toBe(true);

            const result2 = await directoryExists({ path: "./non-existent" });
            expect(result2).toBe(false);
        } finally {
            process.chdir(originalCwd);
            await rm(testDir, { recursive: true, force: true });
        }
    });

    test("handles paths with special characters", async () => {
        const { path: testDir } = await createTestDir({ functionName: "directoryExists" });

        try {
            // Create directory with special characters
            const specialDir = join(testDir, "dir with spaces & symbols!");
            await mkdir(specialDir, { recursive: true });

            const result = await directoryExists({ path: specialDir });
            expect(result).toBe(true);
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    test("handles deeply nested directories", async () => {
        const { path: testDir } = await createTestDir({ functionName: "directoryExists" });

        try {
            // Create deeply nested directory
            const deepPath = join(testDir, "level1", "level2", "level3", "level4");
            await mkdir(deepPath, { recursive: true });

            // Test each level
            const level1 = join(testDir, "level1");
            const level2 = join(testDir, "level1", "level2");
            const level3 = join(testDir, "level1", "level2", "level3");

            expect(await directoryExists({ path: level1 })).toBe(true);
            expect(await directoryExists({ path: level2 })).toBe(true);
            expect(await directoryExists({ path: level3 })).toBe(true);
            expect(await directoryExists({ path: deepPath })).toBe(true);

            // Test non-existent nested path
            const nonExistent = join(testDir, "level1", "level2", "non-existent");
            expect(await directoryExists({ path: nonExistent })).toBe(false);
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    test("handles empty directory name", async () => {
        const result = await directoryExists({ path: "" });
        expect(result).toBe(false);
    });

    test("handles root directory", async () => {
        // Root directory should exist on Unix-like systems
        if (process.platform !== "win32") {
            const result = await directoryExists({ path: "/" });
            expect(result).toBe(true);
        }
    });

    test("handles current directory", async () => {
        const result = await directoryExists({ path: "." });
        expect(result).toBe(true);

        const result2 = await directoryExists({ path: process.cwd() });
        expect(result2).toBe(true);
    });

    test("handles parent directory references", async () => {
        const { path: testDir } = await createTestDir({ functionName: "directoryExists" });

        try {
            const subDir = join(testDir, "subdir");
            await mkdir(subDir, { recursive: true });

            // Test parent directory reference from subdirectory
            const parentRef = join(subDir, "..");
            const result = await directoryExists({ path: parentRef });
            expect(result).toBe(true);
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });
});