// Tests for sopsDecrypt utility function
// Validates SOPS file decryption with schema validation

import { rm, writeFile as fsWriteFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, describe, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import * as executeModule from "@/util/subprocess/execute";
import { createTestDir } from "@/util/test/createTestDir";
import { sopsDecrypt } from "./sopsDecrypt";
import type { PanfactumContext } from "@/util/context/context";

const mockContext = {
  logger: {
    debug: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {})
  }
} as unknown as PanfactumContext;

describe("sopsDecrypt", () => {
  let mockExecute: ReturnType<typeof spyOn<typeof executeModule, "execute">>;

  beforeEach(() => {
    // Create spies for module functions
    mockExecute = spyOn(executeModule, "execute");
  });

  afterEach(() => {
    // Restore the mocked module functions
    mock.restore();
  });
  test("decrypts valid SOPS file and validates against schema", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsDecrypt" });
    const filePath = join(testDir, "test.sops.json");

    const testSchema = z.object({
      username: z.string(),
      password: z.string(),
      host: z.string()
    });

    try {
      // Create a mock encrypted file
      await fsWriteFile(filePath, "encrypted content");

      // Mock successful SOPS decryption
      mockExecute.mockResolvedValueOnce({
        stdout: JSON.stringify({
          username: "testuser", 
          password: "testpass",
          host: "localhost"
        }),
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      const result = await sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: testSchema,
        throwOnMissing: true
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "host": "localhost",
          "password": "testpass",
          "username": "testuser",
        }
      `);

      expect(mockExecute).toHaveBeenCalledWith({
        command: ["sops", "-d", "--output-type", "json", filePath],
        context: mockContext,
        workingDirectory: testDir
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("returns null when file doesn't exist and throwOnMissing is false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsDecrypt" });
    const filePath = join(testDir, "nonexistent.sops.json");

    const testSchema = z.object({
      username: z.string(),
      password: z.string(),
      host: z.string()
    });

    try {
      const result = await sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: testSchema,
        throwOnMissing: false
      });

      expect(result).toBe(null);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws CLIError when file doesn't exist and throwOnMissing is true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsDecrypt" });
    const filePath = join(testDir, "nonexistent.sops.json");

    const testSchema = z.object({
      username: z.string(),
      password: z.string(),
      host: z.string()
    });

    try {
      await expect(sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: testSchema,
        throwOnMissing: true
      })).rejects.toThrow(CLIError);

      await expect(sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: testSchema,
        throwOnMissing: true
      })).rejects.toThrow(`sops-encrypted file does not exist at ${filePath}`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws CLIError when SOPS decryption fails", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsDecrypt" });
    const filePath = join(testDir, "test.sops.json");

    const testSchema = z.object({
      username: z.string(),
      password: z.string(),
      host: z.string()
    });

    try {
      // Create a file that exists
      await fsWriteFile(filePath, "encrypted content");

      // Mock SOPS failure
      mockExecute.mockRejectedValueOnce(new Error("SOPS decryption failed"));

      await expect(sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: testSchema,
        throwOnMissing: true
      })).rejects.toThrow(CLIError);

      // Mock SOPS failure again for second test
      mockExecute.mockRejectedValueOnce(new Error("SOPS decryption failed"));

      await expect(sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: testSchema,
        throwOnMissing: true
      })).rejects.toThrow(`Failed to decrypt sops file at ${filePath}`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws CLIError when decrypted output is invalid JSON", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsDecrypt" });
    const filePath = join(testDir, "test.sops.json");

    const testSchema = z.object({
      username: z.string(),
      password: z.string(),
      host: z.string()
    });

    try {
      await fsWriteFile(filePath, "encrypted content");

      // Mock invalid JSON output
      mockExecute.mockResolvedValueOnce({
        stdout: "invalid json {{{",
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      await expect(sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: testSchema,
        throwOnMissing: true
      })).rejects.toThrow(CLIError);

      // Mock invalid JSON output again for second test
      mockExecute.mockResolvedValueOnce({
        stdout: "invalid json {{{",
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      await expect(sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: testSchema,
        throwOnMissing: true
      })).rejects.toThrow(`Invalid JSON output from sops decrypt for file at ${filePath}`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws PanfactumZodError when decrypted data doesn't match schema", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsDecrypt" });
    const filePath = join(testDir, "test.sops.json");

    const testSchema = z.object({
      username: z.string(),
      password: z.string(),
      host: z.string()
    });

    try {
      await fsWriteFile(filePath, "encrypted content");

      // Mock data that doesn't match schema
      mockExecute.mockResolvedValueOnce({
        stdout: JSON.stringify({
          wrongField: "value",
          anotherWrongField: 123
        }),
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      await expect(sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: testSchema,
        throwOnMissing: true
      })).rejects.toThrow(PanfactumZodError);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("works with generic record schema", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsDecrypt" });
    const filePath = join(testDir, "test.sops.json");

    const recordSchema = z.record(z.unknown());

    try {
      await fsWriteFile(filePath, "encrypted content");

      mockExecute.mockResolvedValueOnce({
        stdout: JSON.stringify({
          anyKey: "anyValue",
          anotherKey: 42,
          nestedKey: { nested: "value" }
        }),
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      const result = await sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: recordSchema,
        throwOnMissing: true
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "anotherKey": 42,
          "anyKey": "anyValue",
          "nestedKey": {
            "nested": "value",
          },
        }
      `);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("uses correct working directory for SOPS command", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsDecrypt" });
    const subDir = join(testDir, "subdir");
    const filePath = join(subDir, "test.sops.json");

    const recordSchema = z.record(z.unknown());

    try {
      // Create the subdirectory first
      const { mkdir } = await import("node:fs/promises");
      await mkdir(subDir, { recursive: true });
      
      await fsWriteFile(filePath, "encrypted content");

      mockExecute.mockResolvedValueOnce({
        stdout: JSON.stringify({ key: "value" }),
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      await sopsDecrypt({
        filePath,
        context: mockContext,
        validationSchema: recordSchema,
        throwOnMissing: true
      });

      expect(mockExecute).toHaveBeenCalledWith({
        command: ["sops", "-d", "--output-type", "json", filePath],
        context: mockContext,
        workingDirectory: subDir
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});