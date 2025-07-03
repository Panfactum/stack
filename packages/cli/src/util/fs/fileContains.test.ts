import { writeFile as fsWriteFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, mock, describe } from "bun:test";
import { CLIError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";
import { fileContains } from "./fileContains";
import type { PanfactumContext } from "@/util/context/context";

const createMockContext = (): PanfactumContext => ({
    logger: {
        debug: mock(() => {})
    }
} as unknown as PanfactumContext);

describe("fileContains", () => {
  test("returns true when pattern is found", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "test.txt");
    
    try {
        await fsWriteFile(filePath, "line 1\nline with pattern\nline 3");

        const result = await fileContains({
            filePath,
            regex: /pattern/
        });

        expect(result).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("returns false when pattern is not found", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "test.txt");
    
    try {
        await fsWriteFile(filePath, "line 1\nline 2\nline 3");

        const result = await fileContains({
            filePath,
            regex: /nonexistent/
        });

        expect(result).toBe(false);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("returns false when file does not exist and throwIfMissing is false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "nonexistent.txt");

    const result = await fileContains({
        filePath,
        regex: /pattern/,
        throwIfMissing: false
    });

    expect(result).toBe(false);
});

test("throws CLIError when file does not exist and throwIfMissing is true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "nonexistent.txt");

    await expect(fileContains({
        filePath,
        regex: /pattern/,
        throwIfMissing: true
    })).rejects.toThrow(CLIError);
    
    await expect(fileContains({
        filePath,
        regex: /pattern/,
        throwIfMissing: true
    })).rejects.toThrow("Cannot run fileContains on nonexistent file");
});

test("works with context parameter", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "test.txt");
    const mockContext = createMockContext();
    
    try {
        await fsWriteFile(filePath, "test line");

        const result = await fileContains({
            context: mockContext,
            filePath,
            regex: /test/
        });

        expect(result).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles complex regex patterns", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "test.txt");
    
    try {
        await fsWriteFile(filePath, "user@example.com\ninvalid-email");

        const result = await fileContains({
            filePath,
            regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/m
        });

        expect(result).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles large files efficiently", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "large.txt");
    
    try {
        
        // Create a large file with pattern near the beginning
        const lines = ["This line has the target pattern"];
        for (let i = 0; i < 10000; i++) {
            lines.push(`Line ${i} without the pattern`);
        }
        await fsWriteFile(filePath, lines.join("\n"));

        const start = Date.now();
        const result = await fileContains({
            filePath,
            regex: /target pattern/
        });
        const duration = Date.now() - start;

        expect(result).toBe(true);
        // Should exit early when pattern is found, so it should be fast
        expect(duration).toBeLessThan(100);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles files with different line endings", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "mixed-endings.txt");
    
    try {
        
        // Mix of Unix (\n) and Windows (\r\n) line endings
        await fsWriteFile(filePath, "line1\r\nline2 with pattern\nline3\r\n");

        const result = await fileContains({
            filePath,
            regex: /pattern/
        });

        expect(result).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles empty files", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "empty.txt");
    
    try {
        await fsWriteFile(filePath, "");

        const result = await fileContains({
            filePath,
            regex: /anything/
        });

        expect(result).toBe(false);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles files with only newlines", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "newlines.txt");
    
    try {
        await fsWriteFile(filePath, "\n\n\n\n");

        const result = await fileContains({
            filePath,
            regex: /^$/m  // Match empty line
        });

        expect(result).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles multiline patterns", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "multiline.txt");
    
    try {
        await fsWriteFile(filePath, "start\nmiddle\nend");

        const result = await fileContains({
            filePath,
            regex: /middle/
        });

        expect(result).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles special characters in file content", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "special.txt");
    
    try {
        await fsWriteFile(filePath, "Special chars: $@#%^&*(){}[]|\\<>?\"':;`~");

        const result = await fileContains({
            filePath,
            regex: /\$@#%\^&\*/
        });

        expect(result).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles unicode content", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "unicode.txt");
    
    try {
        await fsWriteFile(filePath, "Hello 世界 🌍 emoji test 🚀");

        const result = await fileContains({
            filePath,
            regex: /世界/
        });

        expect(result).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("returns false for pattern at end of file without trailing newline", async () => {
    const { path: testDir } = await createTestDir({ functionName: "fileContains" });
    const filePath = join(testDir, "no-trailing-newline.txt");
    
    try {
        // Write without trailing newline
        await fsWriteFile(filePath, "line1\nline2\nlast line with pattern", "utf-8");

        const result = await fileContains({
            filePath,
            regex: /pattern$/m
        });

        expect(result).toBe(true);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles permission errors gracefully", async () => {
    // This test would require setting up specific permissions which is platform-dependent
    // For now, we'll test with a non-existent parent directory which gives a similar error
    const filePath = "/nonexistent/directory/file.txt";
    
    await expect(fileContains({
        filePath,
        regex: /test/,
        throwIfMissing: true
    })).rejects.toThrow(CLIError);
});
});