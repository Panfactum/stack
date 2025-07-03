// Tests for readJSONFile utility function
// Verifies JSON file reading, parsing, and validation functionality

import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, mock, describe } from "bun:test";
import { z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";
import { readJSONFile } from "./readJSONFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Creates a mock Panfactum context for testing
 */
const createMockContext = (): PanfactumContext => ({
    logger: {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {})
    }
} as unknown as PanfactumContext);

// Define test schemas
const simpleSchema = z.object({
    name: z.string(),
    age: z.number(),
    active: z.boolean()
});

const complexSchema = z.object({
    id: z.string().uuid(),
    settings: z.object({
        theme: z.enum(["light", "dark"]),
        notifications: z.boolean(),
        volume: z.number().min(0).max(100)
    }),
    tags: z.array(z.string()),
    metadata: z.record(z.string(), z.unknown()).optional()
});

const nestedSchema = z.object({
    users: z.array(z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
        roles: z.array(z.enum(["admin", "user", "guest"]))
    })),
    config: z.object({
        database: z.object({
            host: z.string(),
            port: z.number(),
            ssl: z.boolean()
        })
    })
});

describe("readJSONFile", () => {
  test("successfully reads and validates valid JSON file", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "valid.json");
    const context = createMockContext();
    
    const testData = {
        name: "John Doe",
        age: 30,
        active: true
    };
    
    try {
        await writeFile(jsonPath, JSON.stringify(testData));
        
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema
        });
        
        expect(result).toEqual(testData);
        expect(context.logger.debug).toHaveBeenCalledWith("Reading JSON file", { filePath: jsonPath });
        expect(context.logger.debug).toHaveBeenCalledWith("Finished reading JSON file", { filePath: jsonPath });
        expect(context.logger.debug).toHaveBeenCalledWith("Validating JSON", { filePath: jsonPath });
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("reads complex JSON with nested objects and arrays", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "complex.json");
    const context = createMockContext();
    
    const testData = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        settings: {
            theme: "dark" as const,
            notifications: true,
            volume: 75
        },
        tags: ["important", "work", "urgent"],
        metadata: {
            createdBy: "system",
            version: "1.0.0"
        }
    };
    
    try {
        await writeFile(jsonPath, JSON.stringify(testData, null, 2));
        
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: complexSchema
        });
        
        expect(result).toEqual(testData);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("throws CLIError when file does not exist and throwOnMissing is true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "nonexistent.json");
    const context = createMockContext();
    
    try {
        await expect(readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema,
            throwOnMissing: true
        })).rejects.toThrow(CLIError);
        
        await expect(readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema,
            throwOnMissing: true
        })).rejects.toThrow(`File does not exist at ${jsonPath}`);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("returns null when file does not exist and throwOnMissing is false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "nonexistent.json");
    const context = createMockContext();
    
    try {
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema,
            throwOnMissing: false
        });
        
        expect(result).toBeNull();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("throws CLIError when file is empty and throwOnEmpty is true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "empty.json");
    const context = createMockContext();
    
    try {
        await writeFile(jsonPath, "");
        
        await expect(readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema,
            throwOnEmpty: true
        })).rejects.toThrow(CLIError);
        
        await expect(readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema,
            throwOnEmpty: true
        })).rejects.toThrow(`File is empty at ${jsonPath}`);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("returns null when file is empty and throwOnEmpty is false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "empty.json");
    const context = createMockContext();
    
    try {
        await writeFile(jsonPath, "");
        
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema,
            throwOnEmpty: false
        });
        
        expect(result).toBeNull();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles files with only whitespace as empty", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "whitespace.json");
    const context = createMockContext();
    
    try {
        await writeFile(jsonPath, "   \n\t\r\n   ");
        
        await expect(readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema,
            throwOnEmpty: true
        })).rejects.toThrow(`File is empty at ${jsonPath}`);
        
        // With throwOnEmpty false
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema,
            throwOnEmpty: false
        });
        expect(result).toBeNull();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("throws CLIError for invalid JSON syntax", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "invalid.json");
    const context = createMockContext();
    
    const invalidJsonExamples = [
        "{ name: 'John' }",  // Unquoted property name
        "{ 'name': 'John' }", // Single quotes
        "{ \"name\": \"John\" ", // Missing closing brace
        "[ 1, 2, 3, ]",       // Trailing comma
        "undefined",          // Not valid JSON
        "{ \"a\": NaN }",      // NaN is not valid JSON
    ];
    
    try {
        for (const invalidJson of invalidJsonExamples) {
            await writeFile(jsonPath, invalidJson);
            
            await expect(readJSONFile({
                context,
                filePath: jsonPath,
                validationSchema: simpleSchema
            })).rejects.toThrow(CLIError);
            
            await expect(readJSONFile({
                context,
                filePath: jsonPath,
                validationSchema: simpleSchema
            })).rejects.toThrow(`Invalid JSON syntax in file at ${jsonPath}`);
        }
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("throws PanfactumZodError when validation fails", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "invalid-schema.json");
    const context = createMockContext();
    
    const invalidData = {
        name: "John Doe",
        age: "thirty", // Should be number
        active: "yes"  // Should be boolean
    };
    
    try {
        await writeFile(jsonPath, JSON.stringify(invalidData));
        
        await expect(readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema
        })).rejects.toThrow(PanfactumZodError);
        
        await expect(readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema
        })).rejects.toThrow("Invalid values in JSON file");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles deeply nested JSON structures", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "nested.json");
    const context = createMockContext();
    
    const nestedData = {
        users: [
            {
                id: 1,
                name: "Alice",
                email: "alice@example.com",
                roles: ["admin", "user"] as ("admin" | "user" | "guest")[]
            },
            {
                id: 2,
                name: "Bob",
                email: "bob@example.com",
                roles: ["user"] as ("admin" | "user" | "guest")[]
            }
        ],
        config: {
            database: {
                host: "localhost",
                port: 5432,
                ssl: true
            }
        }
    };
    
    try {
        await writeFile(jsonPath, JSON.stringify(nestedData));
        
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: nestedSchema
        });
        
        expect(result).toEqual(nestedData);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles JSON with unicode and special characters", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "unicode.json");
    const context = createMockContext();
    
    const unicodeSchema = z.object({
        text: z.string(),
        emoji: z.string(),
        languages: z.array(z.string())
    });
    
    const unicodeData = {
        text: "Hello 世界 🌍",
        emoji: "🚀💻🎉",
        languages: ["English", "中文", "日本語", "العربية"]
    };
    
    try {
        await writeFile(jsonPath, JSON.stringify(unicodeData));
        
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: unicodeSchema
        });
        
        expect(result).toEqual(unicodeData);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles large JSON files", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "large.json");
    const context = createMockContext();
    
    const largeArraySchema = z.object({
        items: z.array(z.object({
            id: z.number(),
            value: z.string()
        }))
    });
    
    // Create a large array
    const items = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: `Item ${i}`
    }));
    
    const largeData = { items };
    
    try {
        await writeFile(jsonPath, JSON.stringify(largeData));
        
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: largeArraySchema
        });
        
        expect(result?.items.length).toBe(10000);
        expect(result?.items[0]).toEqual({ id: 0, value: "Item 0" });
        expect(result?.items[9999]).toEqual({ id: 9999, value: "Item 9999" });
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles JSON with null and undefined values", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "nullable.json");
    const context = createMockContext();
    
    const nullableSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable(),
        nullableOptional: z.string().nullable().optional()
    });
    
    const nullableData = {
        required: "value",
        optional: undefined,
        nullable: null,
        nullableOptional: null
    };
    
    try {
        // JSON.stringify will omit undefined values
        await writeFile(jsonPath, JSON.stringify(nullableData));
        
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: nullableSchema
        });
        
        expect(result).toEqual({
            required: "value",
            nullable: null,
            nullableOptional: null
            // optional is omitted because undefined is not serialized in JSON
        });
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("validates JSON arrays at root level", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "array.json");
    const context = createMockContext();
    
    // Note: The function expects object schemas, but let's test edge case
    const arraySchema = z.array(z.number()) as unknown as z.ZodType<object>;
    
    try {
        await writeFile(jsonPath, JSON.stringify([1, 2, 3, 4, 5]));
        
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: arraySchema
        });
        
        expect(result).toEqual([1, 2, 3, 4, 5]);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles files with BOM (Byte Order Mark)", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "bom.json");
    const context = createMockContext();
    
    const testData = {
        name: "Test",
        age: 25,
        active: true
    };
    
    try {
        // Write file with UTF-8 BOM
        const bom = "\uFEFF";
        await writeFile(jsonPath, bom + JSON.stringify(testData));
        
        const result = await readJSONFile({
            context,
            filePath: jsonPath,
            validationSchema: simpleSchema
        });
        
        expect(result).toEqual(testData);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles relative file paths", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "relative.json");
    const context = createMockContext();
    const originalCwd = process.cwd();
    
    const testData = {
        name: "Relative Path Test",
        age: 42,
        active: false
    };
    
    try {
        await writeFile(jsonPath, JSON.stringify(testData));
        
        // Change to test directory
        process.chdir(testDir);
        
        const result = await readJSONFile({
            context,
            filePath: "./relative.json",
            validationSchema: simpleSchema
        });
        
        expect(result).toEqual(testData);
    } finally {
        process.chdir(originalCwd);
        await rm(testDir, { recursive: true, force: true });
    }
});

test("provides detailed validation errors", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const jsonPath = join(testDir, "validation-error.json");
    const context = createMockContext();
    
    const invalidData = {
        users: [
            {
                id: "not-a-number", // Should be number
                name: "Alice",
                email: "not-an-email", // Invalid email
                roles: ["admin", "superuser"] // Invalid enum value
            }
        ],
        config: {
            database: {
                host: "localhost",
                port: "5432", // Should be number
                ssl: "true" // Should be boolean
            }
        }
    };
    
    try {
        await writeFile(jsonPath, JSON.stringify(invalidData));
        
        try {
            await readJSONFile({
                context,
                filePath: jsonPath,
                validationSchema: nestedSchema
            });
            expect(true).toBe(false); // Should not reach here
        } catch (error) {
            expect(error).toBeInstanceOf(PanfactumZodError);
            if (error instanceof PanfactumZodError) {
                // The error should contain details about all validation failures
                expect(error.message).toContain("Invalid values in JSON file");
            }
        }
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles permission errors gracefully", async () => {
    // This test would require setting up specific permissions which is platform-dependent
    // We'll test with a non-existent parent directory which gives a similar error
    const context = createMockContext();
    const impossiblePath = "/nonexistent/deeply/nested/path/file.json";
    
    await expect(readJSONFile({
        context,
        filePath: impossiblePath,
        validationSchema: simpleSchema,
        throwOnMissing: true
    })).rejects.toThrow(CLIError);
});

test("defaults throwOnMissing and throwOnEmpty to true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readJSONFile" });
    const context = createMockContext();
    
    try {
        // Test default throwOnMissing = true
        const missingPath = join(testDir, "missing.json");
        await expect(readJSONFile({
            context,
            filePath: missingPath,
            validationSchema: simpleSchema
            // Not specifying throwOnMissing, should default to true
        })).rejects.toThrow(`File does not exist at ${missingPath}`);
        
        // Test default throwOnEmpty = true
        const emptyPath = join(testDir, "empty.json");
        await writeFile(emptyPath, "");
        await expect(readJSONFile({
            context,
            filePath: emptyPath,
            validationSchema: simpleSchema
            // Not specifying throwOnEmpty, should default to true
        })).rejects.toThrow(`File is empty at ${emptyPath}`);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});
});
