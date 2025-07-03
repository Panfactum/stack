// Tests for sopsUpsert utility function  
// Validates SOPS file upserting (create or update) functionality

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, describe, mock, beforeEach, afterEach, spyOn } from "bun:test";
import * as createDirectoryModule from "@/util/fs/createDirectory";
import * as fileExistsModule from "@/util/fs/fileExists";
import { createTestDir } from "@/util/test/createTestDir";
import * as sopsDecryptModule from "./sopsDecrypt";
import { sopsUpsert } from "./sopsUpsert";
import * as sopsWriteModule from "./sopsWrite";
import type { PanfactumContext } from "@/util/context/context";

const mockContext = {
  logger: {
    debug: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {})
  }
} as unknown as PanfactumContext;

describe("sopsUpsert", () => {
  let mockSopsDecrypt: ReturnType<typeof spyOn<typeof sopsDecryptModule, "sopsDecrypt">>;
  let mockSopsWrite: ReturnType<typeof spyOn<typeof sopsWriteModule, "sopsWrite">>;
  let mockCreateDirectory: ReturnType<typeof spyOn<typeof createDirectoryModule, "createDirectory">>;
  let mockFileExists: ReturnType<typeof spyOn<typeof fileExistsModule, "fileExists">>;

  beforeEach(() => {
    // Create spies for module functions
    mockSopsDecrypt = spyOn(sopsDecryptModule, "sopsDecrypt");
    mockSopsWrite = spyOn(sopsWriteModule, "sopsWrite");
    mockCreateDirectory = spyOn(createDirectoryModule, "createDirectory");
    mockFileExists = spyOn(fileExistsModule, "fileExists");
  });

  afterEach(() => {
    // Restore the mocked module functions
    mock.restore();
  });
  test("creates new file when it doesn't exist", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsUpsert" });
    const filePath = join(testDir, "new-file.sops.json");

    const values = {
      username: "newuser",
      password: "newpass",
      host: "newhost"
    };

    try {
      // Mock file doesn't exist
      mockFileExists.mockResolvedValueOnce(false);
      
      // Mock createDirectory success
      mockCreateDirectory.mockResolvedValueOnce(undefined);
      
      // Mock sopsWrite success
      mockSopsWrite.mockResolvedValueOnce(undefined);

      await sopsUpsert({
        values,
        filePath,
        context: mockContext
      });

      // Verify createDirectory was called with the parent directory
      expect(mockCreateDirectory).toHaveBeenCalledWith({
        dirPath: testDir
      });

      // Verify sopsWrite was called with the values
      expect(mockSopsWrite).toHaveBeenCalledWith({
        values,
        filePath,
        context: mockContext
      });

      // Verify sopsDecrypt was not called since file doesn't exist
      expect(mockSopsDecrypt).not.toHaveBeenCalled();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("updates existing file by merging with current data", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsUpsert" });
    const filePath = join(testDir, "existing-file.sops.json");

    const existingData = {
      username: "olduser",
      password: "oldpass",
      environment: "production"
    };

    const newValues = {
      username: "newuser",
      host: "newhost"
    };

    const expectedMerged = {
      username: "newuser", // Updated
      password: "oldpass", // Preserved
      environment: "production", // Preserved
      host: "newhost" // Added
    };

    try {
      // Mock file exists
      mockFileExists.mockResolvedValueOnce(true);

      // Mock existing data from sopsDecrypt
      mockSopsDecrypt.mockResolvedValueOnce(existingData);
      
      // Mock sopsWrite success
      mockSopsWrite.mockResolvedValueOnce(undefined);

      await sopsUpsert({
        values: newValues,
        filePath,
        context: mockContext
      });

      // Verify sopsDecrypt was called to read existing data
      expect(mockSopsDecrypt).toHaveBeenCalled();
      expect(mockSopsDecrypt.mock.calls[0]).toHaveLength(1);
      
      // Use expect.objectContaining to match the call partially
      const decryptCall = mockSopsDecrypt.mock.calls[0]?.[0];
      expect(decryptCall).toBeDefined();
      expect(decryptCall).toMatchObject({
        filePath,
        context: mockContext
      });
      
      // Verify validationSchema exists
      expect(decryptCall).toHaveProperty('validationSchema');

      // Verify sopsWrite was called with merged data and overwrite flag
      expect(mockSopsWrite).toHaveBeenCalledWith({
        values: expectedMerged,
        filePath,
        context: mockContext,
        overwrite: true
      });

      // Verify createDirectory was not called since file exists
      expect(mockCreateDirectory).not.toHaveBeenCalled();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles undefined values correctly in merge", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsUpsert" });
    const filePath = join(testDir, "test-file.sops.json");

    const existingData = {
      username: "user",
      password: "pass",
      host: "localhost"
    };

    const newValues = {
      username: "newuser",
      password: undefined, // Should remove this key
      environment: "staging"
    };

    const expectedMerged = {
      username: "newuser",
      host: "localhost", // Preserved from existing
      environment: "staging" // Added
      // password should be removed due to undefined
    };

    try {
      mockFileExists.mockResolvedValueOnce(true);
      mockSopsDecrypt.mockResolvedValueOnce(existingData);
      mockSopsWrite.mockResolvedValueOnce(undefined);

      await sopsUpsert({
        values: newValues,
        filePath,
        context: mockContext
      });

      expect(mockSopsWrite).toHaveBeenCalledWith({
        values: expectedMerged,
        filePath,
        context: mockContext,
        overwrite: true
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles empty existing data", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsUpsert" });
    const filePath = join(testDir, "empty-file.sops.json");

    const newValues = {
      key1: "value1",
      key2: ["array", "value"]
    };

    try {
      mockFileExists.mockResolvedValueOnce(true);
      mockSopsDecrypt.mockResolvedValueOnce({});
      mockSopsWrite.mockResolvedValueOnce(undefined);

      await sopsUpsert({
        values: newValues,
        filePath,
        context: mockContext
      });

      expect(mockSopsWrite).toHaveBeenCalledWith({
        values: newValues,
        filePath,
        context: mockContext,
        overwrite: true
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles array values correctly", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsUpsert" });
    const filePath = join(testDir, "array-file.sops.json");

    const existingData = {
      servers: ["server1", "server2"],
      config: "value"
    };

    const newValues = {
      servers: ["server3", "server4"], // Should replace entire array
      newConfig: "newValue"
    };

    const expectedMerged = {
      servers: ["server3", "server4"],
      config: "value",
      newConfig: "newValue"
    };

    try {
      mockFileExists.mockResolvedValueOnce(true);
      mockSopsDecrypt.mockResolvedValueOnce(existingData);
      mockSopsWrite.mockResolvedValueOnce(undefined);

      await sopsUpsert({
        values: newValues,
        filePath,
        context: mockContext
      });

      expect(mockSopsWrite).toHaveBeenCalledWith({
        values: expectedMerged,
        filePath,
        context: mockContext,
        overwrite: true
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("creates nested directory structure when needed", async () => {
    const { path: testDir } = await createTestDir({ functionName: "sopsUpsert" });
    const nestedPath = join(testDir, "deep", "nested", "path");
    const filePath = join(nestedPath, "file.sops.json");

    const values = {
      key: "value"
    };

    try {
      mockFileExists.mockResolvedValueOnce(false);
      mockCreateDirectory.mockResolvedValueOnce(undefined);
      mockSopsWrite.mockResolvedValueOnce(undefined);

      await sopsUpsert({
        values,
        filePath,
        context: mockContext
      });

      expect(mockCreateDirectory).toHaveBeenCalledWith({
        dirPath: nestedPath
      });

      expect(mockSopsWrite).toHaveBeenCalledWith({
        values,
        filePath,
        context: mockContext
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});