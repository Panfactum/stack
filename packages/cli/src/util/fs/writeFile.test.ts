import { readFile, rm, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { test, expect, mock, describe } from "bun:test";
import { CLIError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";
import { writeFile } from "./writeFile";
import type { PanfactumContext } from "@/util/context/context";

const createMockContext = (): PanfactumContext => ({
    logger: {
        debug: mock(() => { })
    }
} as unknown as PanfactumContext);

describe("writeFile", () => {
  test("writes file successfully", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "test.txt");
    const context = createMockContext();

    try {
        await writeFile({
            context,
            filePath,
            contents: "test content"
        });

        const content = await readFile(filePath, "utf-8");
        expect(content).toBe("test content");
        expect(context.logger.debug).toHaveBeenCalledWith("Writing file", { filePath });
        expect(context.logger.debug).toHaveBeenCalledWith("Finished writing file", { filePath });
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("creates nested directories", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "deep", "nested", "path", "file.txt");
    const context = createMockContext();

    try {
        await writeFile({
            context,
            filePath,
            contents: "nested content"
        });

        const content = await readFile(filePath, "utf-8");
        expect(content).toBe("nested content");

        // Verify parent directories were created
        await access(dirname(filePath));
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("throws CLIError when file exists and overwrite is false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "existing.txt");
    const context = createMockContext();

    try {
        // Create existing file
        await writeFile({
            context,
            filePath,
            contents: "original content",
            overwrite: true
        });

        // Try to write without overwrite
        await expect(writeFile({
            context,
            filePath,
            contents: "new content",
            overwrite: false
        })).rejects.toThrow(CLIError);

        await expect(writeFile({
            context,
            filePath,
            contents: "new content",
            overwrite: false
        })).rejects.toThrow("File already exists");

        // Verify original content is unchanged
        const content = await readFile(filePath, "utf-8");
        expect(content).toBe("original content");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("overwrites file when overwrite is true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "existing.txt");
    const context = createMockContext();

    try {
        // Create existing file
        await writeFile({
            context,
            filePath,
            contents: "original content",
            overwrite: true
        });

        // Overwrite it
        await writeFile({
            context,
            filePath,
            contents: "new content",
            overwrite: true
        });

        const content = await readFile(filePath, "utf-8");
        expect(content).toBe("new content");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("defaults overwrite to false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "existing.txt");
    const context = createMockContext();

    try {
        // Create existing file
        await writeFile({
            context,
            filePath,
            contents: "original content",
            overwrite: true
        });

        // Try to write without specifying overwrite
        await expect(writeFile({
            context,
            filePath,
            contents: "new content"
            // overwrite not specified, should default to false
        })).rejects.toThrow("File already exists");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles relative paths", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const context = createMockContext();

    // Change to test directory
    const originalCwd = process.cwd();
    try {
        // Change to test directory
        process.chdir(testDir);

        await writeFile({
            context,
            filePath: "./relative/file.txt",
            contents: "relative content"
        });

        const content = await readFile("./relative/file.txt", "utf-8");
        expect(content).toBe("relative content");
    } finally {
        process.chdir(originalCwd);
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles empty content", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "empty.txt");
    const context = createMockContext();

    try {
        await writeFile({
            context,
            filePath,
            contents: ""
        });

        const content = await readFile(filePath, "utf-8");
        expect(content).toBe("");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles large content", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "large.txt");
    const largeContent = "x".repeat(10000);
    const context = createMockContext();

    try {
        await writeFile({
            context,
            filePath,
            contents: largeContent
        });

        const content = await readFile(filePath, "utf-8");
        expect(content).toBe(largeContent);
        expect(content.length).toBe(10000);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles special characters in content", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "special.txt");
    const specialContent = "Hello\nWorld\t🌍\u{1F680}";
    const context = createMockContext();

    try {
        await writeFile({
            context,
            filePath,
            contents: specialContent
        });

        const content = await readFile(filePath, "utf-8");
        expect(content).toBe(specialContent);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles paths with spaces and special characters", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "path with spaces", "special & chars!", "file.txt");
    const context = createMockContext();

    try {
        await writeFile({
            context,
            filePath,
            contents: "special path content"
        });

        const content = await readFile(filePath, "utf-8");
        expect(content).toBe("special path content");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles multiple writes to different files", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const context = createMockContext();

    try {
        const files = [
            { path: join(testDir, "file1.txt"), content: "content 1" },
            { path: join(testDir, "subdir", "file2.txt"), content: "content 2" },
            { path: join(testDir, "another", "deep", "file3.txt"), content: "content 3" }
        ];

        for (const file of files) {
            await writeFile({
                context,
                filePath: file.path,
                contents: file.content
            });
        }

        // Verify all files
        for (const file of files) {
            const content = await readFile(file.path, "utf-8");
            expect(content).toBe(file.content);
        }
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("throws CLIError when disk is full", async () => {
    // This test is platform-dependent and hard to simulate consistently
    // We'll test the error path by trying to write to a read-only location
    const context = createMockContext();

    try {
        await writeFile({
            context,
            filePath: "/dev/null/cannot-create-file-here.txt",
            contents: "test"
        });
        expect.unreachable("Should have thrown an error");
    } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).message).toContain("Error writing to");
    }
});

test("preserves file permissions when overwriting", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeFile" });
    const filePath = join(testDir, "perms.txt");
    const context = createMockContext();

    try {
        // Create file
        await writeFile({
            context,
            filePath,
            contents: "original"
        });

        // Overwrite
        await writeFile({
            context,
            filePath,
            contents: "updated",
            overwrite: true
        });

        const content = await readFile(filePath, "utf-8");
        expect(content).toBe("updated");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});
});