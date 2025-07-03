// Tests for parseJson utility function
// Verifies JSON string parsing and validation functionality

import { test, expect, describe } from "bun:test";
import { z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { parseJson } from "./parseJson";

// Define test schemas
const userSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email()
});

const configSchema = z.object({
    apiUrl: z.string().url(),
    timeout: z.number().positive(),
    features: z.object({
        darkMode: z.boolean(),
        beta: z.boolean().optional()
    })
});

describe("parseJson", () => {
  test("successfully parses and validates valid JSON", () => {
    const jsonString = JSON.stringify({
        id: 123,
        name: "John Doe",
        email: "john@example.com"
    });
    
    const result = parseJson(userSchema, jsonString);
    
    expect(result).toEqual({
        id: 123,
        name: "John Doe",
        email: "john@example.com"
    });
  });

  test("throws CLIError for invalid JSON syntax", () => {
    const invalidJsonStrings = [
        "{ invalid json }",
        "{ 'single': 'quotes' }",
        "{ missing: closing brace",
        "[ 1, 2, 3, ]",  // trailing comma
        "undefined",
        "{ \"key\": NaN }"
    ];
    
    for (const invalidJson of invalidJsonStrings) {
        expect(() => parseJson(userSchema, invalidJson)).toThrow(CLIError);
        expect(() => parseJson(userSchema, invalidJson)).toThrow("Failed to parse JSON");
    }
  });

  test("throws PanfactumZodError for schema validation failure", () => {
    const jsonString = JSON.stringify({
        id: "not-a-number",  // Should be number
        name: "John Doe",
        email: "not-an-email"  // Invalid email format
    });
    
    expect(() => parseJson(userSchema, jsonString)).toThrow(PanfactumZodError);
    expect(() => parseJson(userSchema, jsonString)).toThrow("Invalid JSON structure");
  });

  test("handles complex nested objects", () => {
    const jsonString = JSON.stringify({
        apiUrl: "https://api.example.com",
        timeout: 5000,
        features: {
            darkMode: true,
            beta: false
        }
    });
    
    const result = parseJson(configSchema, jsonString);
    
    expect(result).toEqual({
        apiUrl: "https://api.example.com",
        timeout: 5000,
        features: {
            darkMode: true,
            beta: false
        }
    });
  });

  test("handles optional fields correctly", () => {
    const jsonString = JSON.stringify({
        apiUrl: "https://api.example.com",
        timeout: 3000,
        features: {
            darkMode: false
            // beta is optional and omitted
        }
    });
    
    const result = parseJson(configSchema, jsonString);
    
    expect(result).toEqual({
        apiUrl: "https://api.example.com",
        timeout: 3000,
        features: {
            darkMode: false
        }
    });
  });

  test("validates arrays", () => {
    const arraySchema = z.array(z.number());
    const jsonString = JSON.stringify([1, 2, 3, 4, 5]);
    
    const result = parseJson(arraySchema, jsonString);
    
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  test("handles empty objects and arrays", () => {
    const emptyObjectSchema = z.object({});
    const emptyArraySchema = z.array(z.unknown());
    
    expect(parseJson(emptyObjectSchema, "{}")).toEqual({});
    expect(parseJson(emptyArraySchema, "[]")).toEqual([]);
  });

  test("validates string literals and enums", () => {
    const enumSchema = z.object({
        status: z.enum(["active", "inactive", "pending"]),
        role: z.literal("admin")
    });
    
    const validJson = JSON.stringify({
        status: "active",
        role: "admin"
    });
    
    const result = parseJson(enumSchema, validJson);
    expect(result).toEqual({ status: "active", role: "admin" });
    
    // Invalid enum value
    const invalidJson = JSON.stringify({
        status: "unknown",
        role: "admin"
    });
    
    expect(() => parseJson(enumSchema, invalidJson)).toThrow(PanfactumZodError);
  });

  test("handles null and undefined values", () => {
    const nullableSchema = z.object({
        required: z.string(),
        nullable: z.string().nullable(),
        optional: z.string().optional(),
        nullableOptional: z.string().nullable().optional()
    });
    
    const jsonString = JSON.stringify({
        required: "value",
        nullable: null,
        nullableOptional: null
        // optional is omitted (undefined doesn't serialize to JSON)
    });
    
    const result = parseJson(nullableSchema, jsonString);
    
    expect(result).toEqual({
        required: "value",
        nullable: null,
        nullableOptional: null
    });
  });

  test("validates deeply nested structures", () => {
    const deepSchema = z.object({
        level1: z.object({
            level2: z.object({
                level3: z.object({
                    value: z.string()
                })
            })
        })
    });
    
    const jsonString = JSON.stringify({
        level1: {
            level2: {
                level3: {
                    value: "deep value"
                }
            }
        }
    });
    
    const result = parseJson(deepSchema, jsonString);
    
    expect(result).toEqual({
        level1: {
            level2: {
                level3: {
                    value: "deep value"
                }
            }
        }
    });
  });

  test("handles unicode and special characters", () => {
    const unicodeSchema = z.object({
        text: z.string(),
        emoji: z.string(),
        special: z.string()
    });
    
    const jsonString = JSON.stringify({
        text: "Hello 世界",
        emoji: "🚀🌍🎉",
        special: "\"quotes\" & 'apostrophes' < > / \\"
    });
    
    const result = parseJson(unicodeSchema, jsonString);
    
    expect(result).toEqual({
        text: "Hello 世界",
        emoji: "🚀🌍🎉",
        special: "\"quotes\" & 'apostrophes' < > / \\"
    });
  });

  test("validates union types", () => {
    const unionSchema = z.object({
        value: z.union([z.string(), z.number(), z.boolean()])
    });
    
    expect(parseJson(unionSchema, '{"value": "string"}')).toEqual({ value: "string" });
    expect(parseJson(unionSchema, '{"value": 123}')).toEqual({ value: 123 });
    expect(parseJson(unionSchema, '{"value": true}')).toEqual({ value: true });
    
    // Invalid type for union
    expect(() => parseJson(unionSchema, '{"value": null}')).toThrow(PanfactumZodError);
  });

  test("handles large JSON strings", () => {
    const largeArraySchema = z.array(z.object({
        id: z.number(),
        value: z.string()
    }));
    
    const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `Item ${i}`
    }));
    
    const jsonString = JSON.stringify(largeArray);
    const result = parseJson(largeArraySchema, jsonString);
    
    expect(result.length).toBe(1000);
    expect(result[0]).toEqual({ id: 0, value: "Item 0" });
    expect(result[999]).toEqual({ id: 999, value: "Item 999" });
  });

  test("provides detailed validation errors", () => {
    const complexSchema = z.object({
        users: z.array(z.object({
            id: z.number(),
            email: z.string().email()
        })),
        settings: z.object({
            maxUsers: z.number().min(1).max(100)
        })
    });
    
    const invalidJson = JSON.stringify({
        users: [
            { id: "not-a-number", email: "invalid-email" },
            { id: 2, email: "valid@email.com" }
        ],
        settings: {
            maxUsers: 150  // Exceeds max
        }
    });
    
    try {
        parseJson(complexSchema, invalidJson);
        expect(true).toBe(false);  // Should not reach here
    } catch (error) {
        expect(error).toBeInstanceOf(PanfactumZodError);
        if (error instanceof PanfactumZodError) {
            expect(error.location).toBe("JSON input");
            expect(error.validationError.issues.length).toBeGreaterThan(0);
        }
    }
  });

  test("handles JSON with BOM", () => {
    const schema = z.object({ test: z.string() });
    const bom = "\uFEFF";
    const jsonString = bom + JSON.stringify({ test: "value" });
    
    const result = parseJson(schema, jsonString);
    expect(result).toEqual({ test: "value" });
  });

  test("validates records (dynamic keys)", () => {
    const recordSchema = z.object({
        metadata: z.record(z.string(), z.number())
    });
    
    const jsonString = JSON.stringify({
        metadata: {
            count: 42,
            total: 100,
            average: 23.5
        }
    });
    
    const result = parseJson(recordSchema, jsonString);
    
    expect(result).toEqual({
        metadata: {
            count: 42,
            total: 100,
            average: 23.5
        }
    });
  });

  test("handles empty string as invalid JSON", () => {
    expect(() => parseJson(userSchema, "")).toThrow(CLIError);
    expect(() => parseJson(userSchema, "   ")).toThrow(CLIError);
  });

  test("validates transformed values", () => {
    const transformSchema = z.object({
        date: z.string().transform(str => new Date(str)),
        uppercased: z.string().transform(str => str.toUpperCase())
    });
    
    const jsonString = JSON.stringify({
        date: "2024-01-01T00:00:00Z",
        uppercased: "hello"
    });
    
    // Use unknown type to handle Zod transforms
    const result = parseJson(transformSchema as z.ZodType<unknown>, jsonString) as {
        date: Date;
        uppercased: string;
    };
    
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(result.uppercased).toBe("HELLO");
  });
});