// Tests for the createTestDir utility function
// Verifies that test directories are created correctly with unique names

import { rm } from "node:fs/promises";
import { test, expect, describe } from "bun:test";
import { directoryExists } from "@/util/fs/directoryExists";
import { createTestDir } from "./createTestDir";

describe("createTestDir", () => {
  test("creates a directory with the specified function name", async () => {
    const { path: testDir } = await createTestDir({ functionName: "testFunction" });

    try {
      // Verify directory was created
      const exists = await directoryExists({ path: testDir });
      expect(exists).toBe(true);

      // Verify the path contains the function name
      expect(testDir).toContain("testFunction");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("creates unique directories for multiple calls", async () => {
    const { path: dir1 } = await createTestDir({ functionName: "sameFunction" });
    const { path: dir2 } = await createTestDir({ functionName: "sameFunction" });
    const { path: dir3 } = await createTestDir({ functionName: "sameFunction" });

    try {
      // All directories should exist
      expect(await directoryExists({ path: dir1 })).toBe(true);
      expect(await directoryExists({ path: dir2 })).toBe(true);
      expect(await directoryExists({ path: dir3 })).toBe(true);

      // All paths should be unique
      expect(dir1).not.toBe(dir2);
      expect(dir1).not.toBe(dir3);
      expect(dir2).not.toBe(dir3);

      // All should contain the function name
      expect(dir1).toContain("sameFunction");
      expect(dir2).toContain("sameFunction");
      expect(dir3).toContain("sameFunction");
    } finally {
      await rm(dir1, { recursive: true, force: true });
      await rm(dir2, { recursive: true, force: true });
      await rm(dir3, { recursive: true, force: true });
    }
  });

  test("handles function names with special characters", async () => {
    const functionNames = [
      "test-with-dashes",
      "test_with_underscores",
      "testWithCamelCase",
      "test.with.dots",
      "test123WithNumbers"
    ];

    const createdDirs: string[] = [];

    try {
      for (const functionName of functionNames) {
        const { path: testDir } = await createTestDir({ functionName });
        createdDirs.push(testDir);

        // Verify directory was created
        expect(await directoryExists({ path: testDir })).toBe(true);

        // Verify the path contains the function name
        expect(testDir).toContain(functionName);
      }
    } finally {
      // Clean up all created directories
      for (const dir of createdDirs) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  test("creates directories in system temp directory", async () => {
    const { path: testDir } = await createTestDir({ functionName: "tempDirTest" });

    try {
      // Verify directory was created
      expect(await directoryExists({ path: testDir })).toBe(true);

      // Verify it's in a temp directory (platform-agnostic check)
      // On Unix-like systems, it should contain /tmp or /var/folders
      // On Windows, it might contain \Temp\
      const lowerPath = testDir.toLowerCase();
      const isInTempDir = lowerPath.includes("/tmp") ||
        lowerPath.includes("/var/folders") ||
        lowerPath.includes("\\temp\\") ||
        lowerPath.includes("\\local\\temp");

      expect(isInTempDir).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("returns absolute paths", async () => {
    const { path: testDir } = await createTestDir({ functionName: "absolutePathTest" });

    try {
      // Verify directory was created
      expect(await directoryExists({ path: testDir })).toBe(true);

      // Verify it's an absolute path
      // On Unix-like systems, absolute paths start with /
      // On Windows, they might start with a drive letter like C:\
      const isAbsolute = testDir.startsWith("/") || /^[A-Za-z]:\\/.test(testDir);
      expect(isAbsolute).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
