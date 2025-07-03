// Tests for writeYAMLFile utility
// Tests YAML file writing functionality

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { CLIError } from "@/util/error/error";
import { writeFile } from "@/util/fs/writeFile";
import { createTestDir } from "@/util/test/createTestDir";
import { writeYAMLFile } from "./writeYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Mock context for testing
 */
const mockContext: PanfactumContext = {
  logger: {
    debug: () => {},
  },
} as unknown as PanfactumContext;

describe("writeYAMLFile", () => {
  test("writes simple object to YAML file", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeYAMLFile" });
    try {
      const filePath = join(testDir, "output.yaml");
      const values = {
        name: "Test User",
        age: 30,
        active: true,
      };

      await writeYAMLFile({
        context: mockContext,
        filePath,
        values,
      });

      const content = await Bun.file(filePath).text();
      expect(content).toMatchInlineSnapshot(`
"name: Test User
age: 30
active: true
"
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("writes nested object structure to YAML", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeYAMLFile" });
    try {
      const filePath = join(testDir, "nested.yaml");
      const values = {
        config: {
          debug: true,
          nested: {
            deep: {
              value: 42,
            },
          },
        },
        users: ["alice", "bob"],
      };

      await writeYAMLFile({
        context: mockContext,
        filePath,
        values,
      });

      const content = await Bun.file(filePath).text();
      expect(content).toMatchInlineSnapshot(`
"config:
  debug: true
  nested:
    deep:
      value: 42
users:
  - alice
  - bob
"
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("overwrites existing file when overwrite is true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeYAMLFile" });
    try {
      const filePath = join(testDir, "existing.yaml");
      
      // Create initial file
      await writeFile({ 
        context: mockContext, 
        filePath, 
        contents: "old: content\n" 
      });

      const newValues = {
        new: "content",
        updated: true,
      };

      await writeYAMLFile({
        context: mockContext,
        filePath,
        values: newValues,
        overwrite: true,
      });

      const content = await Bun.file(filePath).text();
      expect(content).toMatchInlineSnapshot(`
"new: content
updated: true
"
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws error when file exists and overwrite is false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeYAMLFile" });
    try {
      const filePath = join(testDir, "existing.yaml");
      
      // Create initial file
      await writeFile({ 
        context: mockContext, 
        filePath, 
        contents: "existing: content\n" 
      });

      const newValues = {
        new: "content",
      };

      await expect(
        writeYAMLFile({
          context: mockContext,
          filePath,
          values: newValues,
          overwrite: false,
        })
      ).rejects.toThrow(CLIError);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles arrays and complex data types", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeYAMLFile" });
    try {
      const filePath = join(testDir, "complex.yaml");
      const values = {
        items: [
          { id: 1, name: "Item 1" },
          { id: 2, name: "Item 2" },
        ],
        metadata: {
          created: "2024-01-01",
          tags: ["important", "review"],
          status: null,
        },
        enabled: false,
        count: 0,
      };

      await writeYAMLFile({
        context: mockContext,
        filePath,
        values,
      });

      const content = await Bun.file(filePath).text();
      expect(content).toMatchInlineSnapshot(`
"items:
  - id: 1
    name: Item 1
  - id: 2
    name: Item 2
metadata:
  created: 2024-01-01
  tags:
    - important
    - review
  status: null
enabled: false
count: 0
"
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles empty object", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeYAMLFile" });
    try {
      const filePath = join(testDir, "empty.yaml");
      const values = {};

      await writeYAMLFile({
        context: mockContext,
        filePath,
        values,
      });

      const content = await Bun.file(filePath).text();
      expect(content).toMatchInlineSnapshot(`
"{}
"
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("preserves string formatting with special characters", async () => {
    const { path: testDir } = await createTestDir({ functionName: "writeYAMLFile" });
    try {
      const filePath = join(testDir, "special.yaml");
      const values = {
        multiline: "Line 1\nLine 2\nLine 3",
        quoted: 'This has "quotes" in it',
        special: "Special chars: @#$%^&*()",
        path: "/home/user/file.txt",
        url: "https://example.com",
      };

      await writeYAMLFile({
        context: mockContext,
        filePath,
        values,
      });

      const content = await Bun.file(filePath).text();
      expect(content).toMatchInlineSnapshot(`
"multiline: |-
  Line 1
  Line 2
  Line 3
quoted: This has "quotes" in it
special: "Special chars: @#$%^&*()"
path: /home/user/file.txt
url: https://example.com
"
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});