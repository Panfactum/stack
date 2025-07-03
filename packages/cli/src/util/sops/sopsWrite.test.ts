// Tests for sopsWrite utility function
// Validates SOPS file writing and encryption functionality

import { rm, writeFile as fsWriteFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, describe, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { CLIError } from "@/util/error/error";
import * as fileExistsModule from "@/util/fs/fileExists";
import * as removeFileModule from "@/util/fs/removeFile";
import * as executeModule from "@/util/subprocess/execute";
import { createTestDir } from "@/util/test/createTestDir";
import { sopsWrite } from "./sopsWrite";
import type { PanfactumContext } from "@/util/context/context";

const mockContext = {
  logger: {
    debug: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {})
  }
} as unknown as PanfactumContext;

describe("sopsWrite", () => {
  let mockExecute: ReturnType<typeof spyOn<typeof executeModule, "execute">>;
  let mockFileExists: ReturnType<typeof spyOn<typeof fileExistsModule, "fileExists">>;
  let mockRemoveFile: ReturnType<typeof spyOn<typeof removeFileModule, "removeFile">>;

  beforeEach(() => {
    // Create spies for module functions
    mockExecute = spyOn(executeModule, "execute");
    mockFileExists = spyOn(fileExistsModule, "fileExists");
    mockRemoveFile = spyOn(removeFileModule, "removeFile");
  });

  afterEach(() => {
    // Restore the mocked module functions
    mock.restore();
  });
  test("writes new file when file doesn't exist", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsWrite" });
    const filePath = join(testDir, "new-file.sops.json");

    const values = {
      username: "testuser",
      password: "testpass",
      host: "localhost"
    };

    try {
      // Mock file doesn't exist
      mockFileExists.mockResolvedValueOnce(false);

      // Mock successful SOPS encryption
      mockExecute.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      await sopsWrite({
        values,
        filePath,
        context: mockContext
      });

      // Verify fileExists was called
      expect(mockFileExists).toHaveBeenCalledWith({ filePath });

      // Verify removeFile was not called since file doesn't exist
      expect(mockRemoveFile).not.toHaveBeenCalled();

      // Verify execute was called with correct SOPS command
      expect(mockExecute).toHaveBeenCalledWith({
        command: [
          "sops",
          "-e",
          "--input-type",
          "json",
          "--output",
          filePath,
          "--filename-override",
          filePath,
          "/dev/stdin"
        ],
        context: mockContext,
        workingDirectory: testDir,
        stdin: new globalThis.Blob([JSON.stringify(values)])
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("overwrites existing file when overwrite is true", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsWrite" });
    const filePath = join(testDir, "existing-file.sops.json");

    const values = {
      newKey: "newValue",
      updatedKey: "updatedValue"
    };

    try {
      // Create an existing file
      await fsWriteFile(filePath, "existing encrypted content");

      // Mock file exists
      mockFileExists.mockResolvedValueOnce(true);

      // Mock successful SOPS encryption
      mockExecute.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      await sopsWrite({
        values,
        filePath,
        context: mockContext,
        overwrite: true
      });

      // Verify removeFile was called to delete existing file
      expect(mockRemoveFile).toHaveBeenCalledWith({ filePath });

      // Verify SOPS command was executed
      expect(mockExecute).toHaveBeenCalledWith({
        command: [
          "sops",
          "-e",
          "--input-type",
          "json",
          "--output",
          filePath,
          "--filename-override",
          filePath,
          "/dev/stdin"
        ],
        context: mockContext,
        workingDirectory: testDir,
        stdin: new globalThis.Blob([JSON.stringify(values)])
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws CLIError when file exists and overwrite is false", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsWrite" });
    const filePath = join(testDir, "existing-file.sops.json");

    const values = {
      key: "value"
    };

    try {
      // Create an existing file
      await fsWriteFile(filePath, "existing content");

      // Mock file exists
      mockFileExists.mockResolvedValueOnce(true);

      await expect(sopsWrite({
        values,
        filePath,
        context: mockContext,
        overwrite: false
      })).rejects.toThrow(CLIError);

      // Mock file exists again for second test
      mockFileExists.mockResolvedValueOnce(true);

      await expect(sopsWrite({
        values,
        filePath,
        context: mockContext,
        overwrite: false
      })).rejects.toThrow(`File already exists at ${filePath}. Use overwrite=true if you want to overwrite it without error.`);

      // Verify removeFile and execute were not called
      expect(mockRemoveFile).not.toHaveBeenCalled();
      expect(mockExecute).not.toHaveBeenCalled();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws CLIError when file exists and overwrite is undefined (defaults to false)", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsWrite" });
    const filePath = join(testDir, "existing-file.sops.json");

    const values = {
      key: "value"
    };

    try {
      // Create an existing file
      await fsWriteFile(filePath, "existing content");

      // Mock file exists
      mockFileExists.mockResolvedValueOnce(true);

      await expect(sopsWrite({
        values,
        filePath,
        context: mockContext
        // overwrite not specified, should default to false
      })).rejects.toThrow(CLIError);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws CLIError when SOPS encryption fails", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsWrite" });
    const filePath = join(testDir, "test-file.sops.json");

    const values = {
      key: "value"
    };

    try {
      // Mock file doesn't exist
      mockFileExists.mockResolvedValueOnce(false);

      // Mock SOPS encryption failure
      mockExecute.mockRejectedValueOnce(new Error("SOPS encryption failed"));

      await expect(sopsWrite({
        values,
        filePath,
        context: mockContext
      })).rejects.toThrow(CLIError);

      // Mock file doesn't exist again for second test
      mockFileExists.mockResolvedValueOnce(false);
      // Mock SOPS encryption failure again
      mockExecute.mockRejectedValueOnce(new Error("SOPS encryption failed"));

      await expect(sopsWrite({
        values,
        filePath,
        context: mockContext
      })).rejects.toThrow("Unable to write encrypted data");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles complex nested object values", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsWrite" });
    const filePath = join(testDir, "complex-file.sops.json");

    const values = {
      database: {
        host: "localhost",
        port: 5432,
        credentials: {
          username: "user",
          password: "pass"
        }
      },
      services: ["api", "web", "worker"],
      config: {
        debug: true,
        timeout: 30000
      }
    };

    try {
      mockFileExists.mockResolvedValueOnce(false);
      mockExecute.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      await sopsWrite({
        values,
        filePath,
        context: mockContext
      });

      // Verify the JSON was properly serialized in the stdin
      expect(mockExecute).toHaveBeenCalledWith({
        command: [
          "sops",
          "-e",
          "--input-type",
          "json",
          "--output",
          filePath,
          "--filename-override",
          filePath,
          "/dev/stdin"
        ],
        context: mockContext,
        workingDirectory: testDir,
        stdin: new globalThis.Blob([JSON.stringify(values)])
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("uses correct working directory for SOPS command", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsWrite" });
    const subDir = join(testDir, "subdir");
    const filePath = join(subDir, "test-file.sops.json");

    const values = {
      key: "value"
    };

    try {
      mockFileExists.mockResolvedValueOnce(false);
      mockExecute.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      await sopsWrite({
        values,
        filePath,
        context: mockContext
      });

      // Verify the working directory is set to the file's directory
      expect(mockExecute).toHaveBeenCalledWith({
        command: [
          "sops",
          "-e",
          "--input-type",
          "json",
          "--output",
          filePath,
          "--filename-override",
          filePath,
          "/dev/stdin"
        ],
        context: mockContext,
        workingDirectory: subDir,
        stdin: new globalThis.Blob([JSON.stringify(values)])
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles empty values object", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsWrite" });
    const filePath = join(testDir, "empty-file.sops.json");

    const values = {};

    try {
      mockFileExists.mockResolvedValueOnce(false);
      mockExecute.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
        pid: 12345
      });

      await sopsWrite({
        values,
        filePath,
        context: mockContext
      });

      expect(mockExecute).toHaveBeenCalledWith({
        command: [
          "sops",
          "-e",
          "--input-type",
          "json",
          "--output",
          filePath,
          "--filename-override",
          filePath,
          "/dev/stdin"
        ],
        context: mockContext,
        workingDirectory: testDir,
        stdin: new globalThis.Blob([JSON.stringify({})])
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});