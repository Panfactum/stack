// Tests for readYAMLFile utility
// Tests YAML file reading, parsing, and validation functionality

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { writeFile } from "@/util/fs/writeFile";
import { createTestDir } from "@/util/test/createTestDir";
import { readYAMLFile } from "./readYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Mock context for testing
 */
const mockContext: PanfactumContext = {
  logger: {
    debug: () => {},
  },
} as unknown as PanfactumContext;

/**
 * Test schema for validation
 */
const testSchema = z.object({
  name: z.string(),
  age: z.number(),
  active: z.boolean().optional(),
});

describe("readYAMLFile", () => {
  test("reads and parses valid YAML file with schema validation", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "test.yaml");
      const content = `name: John Doe
age: 30
active: true`;
      await writeFile({ context: mockContext, filePath, contents: content });

      const result = await readYAMLFile({
        context: mockContext,
        filePath,
        validationSchema: testSchema,
      });

      expect(result).toMatchInlineSnapshot(`
{
  "active": true,
  "age": 30,
  "name": "John Doe",
}
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("reads YAML file with passthrough schema", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "test.yaml");
      const content = `foo: bar
nested:
  key: value
  number: 42`;
      await writeFile({ context: mockContext, filePath, contents: content });

      const result = await readYAMLFile({
        context: mockContext,
        filePath,
        validationSchema: z.object({}).passthrough(),
      });

      expect(result).toMatchInlineSnapshot(`
{
  "foo": "bar",
  "nested": {
    "key": "value",
    "number": 42,
  },
}
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles empty file when throwOnEmpty is false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "empty.yaml");
      await Bun.write(filePath, "");

      const result = await readYAMLFile({
        context: mockContext,
        filePath,
        validationSchema: z.object({}).passthrough(),
        throwOnEmpty: false,
      });

      expect(result).toBeNull();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws error for empty file when throwOnEmpty is true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "empty.yaml");
      await Bun.write(filePath, "");

      await expect(
        readYAMLFile({
          context: mockContext,
          filePath,
          validationSchema: z.object({}).passthrough(),
          throwOnEmpty: true,
        })
      ).rejects.toThrow(CLIError);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles missing file when throwOnMissing is false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "nonexistent.yaml");

      const result = await readYAMLFile({
        context: mockContext,
        filePath,
        validationSchema: z.object({}).passthrough(),
        throwOnMissing: false,
      });

      expect(result).toBeNull();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws error for missing file when throwOnMissing is true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "nonexistent.yaml");

      await expect(
        readYAMLFile({
          context: mockContext,
          filePath,
          validationSchema: z.object({}).passthrough(),
          throwOnMissing: true,
        })
      ).rejects.toThrow(CLIError);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws error for invalid YAML syntax", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "invalid.yaml");
      const content = `invalid:
  - yaml
  content: with bad indentation
- missing`;
      await writeFile({ context: mockContext, filePath, contents: content });

      await expect(
        readYAMLFile({
          context: mockContext,
          filePath,
          validationSchema: z.object({}).passthrough(),
        })
      ).rejects.toThrow(CLIError);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws PanfactumZodError for schema validation failure", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "invalid-schema.yaml");
      const content = `name: John Doe
age: "not a number"`;
      await writeFile({ context: mockContext, filePath, contents: content });

      await expect(
        readYAMLFile({
          context: mockContext,
          filePath,
          validationSchema: testSchema,
        })
      ).rejects.toThrow(PanfactumZodError);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles YAML with comments", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "with-comments.yaml");
      const content = `# This is a comment
name: Test User # inline comment
age: 25
# Another comment
active: false`;
      await writeFile({ context: mockContext, filePath, contents: content });

      const result = await readYAMLFile({
        context: mockContext,
        filePath,
        validationSchema: testSchema,
      });

      expect(result).toMatchInlineSnapshot(`
{
  "active": false,
  "age": 25,
  "name": "Test User",
}
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles complex nested YAML structures", async () => {
    const { path: testDir } = await createTestDir({ functionName: "readYAMLFile" });
    try {
      const filePath = join(testDir, "complex.yaml");
      const content = `users:
  - name: Alice
    age: 30
    permissions:
      - read
      - write
  - name: Bob
    age: 25
    permissions:
      - read
config:
  debug: true
  nested:
    deep:
      value: 42`;
      await writeFile({ context: mockContext, filePath, contents: content });

      const result = await readYAMLFile({
        context: mockContext,
        filePath,
        validationSchema: z.object({}).passthrough(),
      });

      expect(result).toMatchInlineSnapshot(`
{
  "config": {
    "debug": true,
    "nested": {
      "deep": {
        "value": 42,
      },
    },
  },
  "users": [
    {
      "age": 30,
      "name": "Alice",
      "permissions": [
        "read",
        "write",
      ],
    },
    {
      "age": 25,
      "name": "Bob",
      "permissions": [
        "read",
      ],
    },
  ],
}
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});