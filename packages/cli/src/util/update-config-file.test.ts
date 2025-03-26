/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import fs from "fs";
import path from "path";
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { updateConfigFile } from "./update-config-file";
import type { BaseContext } from "clipanion";

// Mock dependencies
const mockPrintHelpInformation = mock(() => {});
mock.module("./print-help-information", () => ({
  printHelpInformation: mockPrintHelpInformation,
}));

describe("updateConfigFile", () => {
  const tempDir = path.join(process.cwd(), "test-temp");
  const configPath = path.join(tempDir, "test-config.json");
  const mockContext = {
    stderr: {
      write: mock(() => {}),
    },
  } as unknown as BaseContext;

  beforeEach(() => {
    // Create temp directory and initial config file
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create initial config file
    const initialConfig = {
      existingKey: "existingValue",
      toBeUpdated: "oldValue",
    };
    fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));

    // Reset mocks
    mockPrintHelpInformation.mockReset();
    // Use jest-like mock reset for the write function
    (mockContext.stderr.write as unknown as { mockReset: () => void }).mockReset();
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("should update existing keys in config file", async () => {
    const updates = { toBeUpdated: "newValue" };

    const result = await updateConfigFile({
      updates,
      configPath,
      context: mockContext,
    });

    expect(result).toBeUndefined();

    // Verify file was updated correctly
    const updatedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(updatedConfig.existingKey).toBe("existingValue");
    expect(updatedConfig.toBeUpdated).toBe("newValue");
  });

  test("should add new keys to config file", async () => {
    const updates = { newKey: "newValue" };

    const result = await updateConfigFile({
      updates,
      configPath,
      context: mockContext,
    });

    expect(result).toBeUndefined();

    // Verify file was updated correctly
    const updatedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(updatedConfig.existingKey).toBe("existingValue");
    expect(updatedConfig.toBeUpdated).toBe("oldValue");
    expect(updatedConfig.newKey).toBe("newValue");
  });

  test("should handle multiple updates at once", async () => {
    const updates = {
      toBeUpdated: "newValue",
      newKey: "brandNew",
    };

    const result = await updateConfigFile({
      updates,
      configPath,
      context: mockContext,
    });

    expect(result).toBeUndefined();

    // Verify file was updated correctly
    const updatedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(updatedConfig.existingKey).toBe("existingValue");
    expect(updatedConfig.toBeUpdated).toBe("newValue");
    expect(updatedConfig.newKey).toBe("brandNew");
  });

  test("should return 1 and print error when config file doesn't exist", async () => {
    const nonExistentPath = path.join(tempDir, "non-existent.json");

    const result = await updateConfigFile({
      updates: { key: "value" },
      configPath: nonExistentPath,
      context: mockContext,
    });

    expect(result).toBe(1);
    expect(mockContext.stderr.write).toHaveBeenCalled();
    expect(mockPrintHelpInformation).toHaveBeenCalled();
  });

  test("should return 1 and print error when config file contains invalid JSON", async () => {
    // Create invalid JSON file
    fs.writeFileSync(configPath, "{ invalid json", "utf-8");

    const result = await updateConfigFile({
      updates: { key: "value" },
      configPath,
      context: mockContext,
    });

    expect(result).toBe(1);
    expect(mockContext.stderr.write).toHaveBeenCalled();
    expect(mockPrintHelpInformation).toHaveBeenCalled();
  });
});
