// Tests for upsertGitIgnore utility function
// Verifies .gitignore file creation and updating with deduplication

import { rm, mkdir, writeFile as nodeWriteFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import * as fileExistsModule from "@/util/fs/fileExists";
import * as writeFileModule from "@/util/fs/writeFile";
import { createTestDir } from "@/util/test/createTestDir";
import { upsertGitIgnore } from "./upsertGitIgnore";
import type { PanfactumContext } from "@/util/context/context";

let testDir: string;
let fileExistsMock: ReturnType<typeof spyOn<typeof fileExistsModule, "fileExists">>;
let writeFileMock: ReturnType<typeof spyOn<typeof writeFileModule, "writeFile">>;

const NODE_MODULES_ENTRY = "node_modules/";
const LOG_FILES_ENTRY = "*.log";
const GITIGNORE_FILENAME = ".gitignore";
const ENV_ENTRY = ".env";

const mockContext = {
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {}
  }
} as unknown as PanfactumContext;

describe("upsertGitIgnore", () => {
  beforeEach(async () => {
    // Create test directory structure
    const result = await createTestDir({ functionName: "upsertGitIgnore" });
    testDir = result.path;
    
    // Create spies
    fileExistsMock = spyOn(fileExistsModule, "fileExists");
    writeFileMock = spyOn(writeFileModule, "writeFile");
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
    
    // Restore mocks
    mock.restore();
  });

  test("creates new .gitignore file when it doesn't exist", async () => {
    const gitignorePath = join(testDir, GITIGNORE_FILENAME);
    const linesToAdd = [NODE_MODULES_ENTRY, LOG_FILES_ENTRY, ENV_ENTRY];

    fileExistsMock.mockResolvedValue(false);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    expect(fileExistsMock).toHaveBeenCalledWith({ filePath: gitignorePath });
    expect(writeFileMock).toHaveBeenCalledWith({
      contents: `${NODE_MODULES_ENTRY}\n${LOG_FILES_ENTRY}\n${ENV_ENTRY}\n`,
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("appends new lines to existing .gitignore file", async () => {
    const gitignorePath = join(testDir, GITIGNORE_FILENAME);
    const existingContent = `${NODE_MODULES_ENTRY}\n${LOG_FILES_ENTRY}\n`;
    const newLines = [ENV_ENTRY, "dist/"];

    // Create existing file
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: newLines,
      path: gitignorePath
    });

    expect(writeFileMock).toHaveBeenCalledWith({
      contents: `${NODE_MODULES_ENTRY}\n${LOG_FILES_ENTRY}\n${ENV_ENTRY}\ndist/\n`,
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("filters out duplicate lines from new entries", async () => {
    const gitignorePath = join(testDir, GITIGNORE_FILENAME);
    const existingContent = `${NODE_MODULES_ENTRY}\n${LOG_FILES_ENTRY}\n${ENV_ENTRY}\n`;
    const linesToAdd = [NODE_MODULES_ENTRY, LOG_FILES_ENTRY, "dist/", ENV_ENTRY];

    // Create existing file
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    // Should only add "dist/" since the others already exist
    expect(writeFileMock).toHaveBeenCalledWith({
      contents: `${NODE_MODULES_ENTRY}\n${LOG_FILES_ENTRY}\n${ENV_ENTRY}\ndist/\n`,
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("does nothing when all lines already exist", async () => {
    const gitignorePath = join(testDir, GITIGNORE_FILENAME);
    const existingContent = `${NODE_MODULES_ENTRY}\n${LOG_FILES_ENTRY}\n${ENV_ENTRY}\n`;
    const linesToAdd = [NODE_MODULES_ENTRY, LOG_FILES_ENTRY, ENV_ENTRY];

    // Create existing file
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  test("handles empty lines in existing file", async () => {
    const gitignorePath = join(testDir, GITIGNORE_FILENAME);
    const existingContent = `${NODE_MODULES_ENTRY}\n\n${LOG_FILES_ENTRY}\n\n\n${ENV_ENTRY}\n`;
    const linesToAdd = ["dist/", "build/"];

    // Create existing file with empty lines
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    // Empty lines should be filtered out from existing content
    expect(writeFileMock).toHaveBeenCalledWith({
      contents: `${NODE_MODULES_ENTRY}\n${LOG_FILES_ENTRY}\n${ENV_ENTRY}\ndist/\nbuild/\n`,
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("handles whitespace trimming in existing lines", async () => {
    const gitignorePath = join(testDir, GITIGNORE_FILENAME);
    const existingContent = `  ${NODE_MODULES_ENTRY}  \n\t${LOG_FILES_ENTRY}\t\n ${ENV_ENTRY} \n`;
    const linesToAdd = [NODE_MODULES_ENTRY, "dist/"];

    // Create existing file with whitespace
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    // Should recognize trimmed "node_modules/" as duplicate
    expect(writeFileMock).toHaveBeenCalledWith({
      contents: `${NODE_MODULES_ENTRY}\n${LOG_FILES_ENTRY}\n${ENV_ENTRY}\ndist/\n`,
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("handles empty input lines array", async () => {
    const gitignorePath = join(testDir, GITIGNORE_FILENAME);

    fileExistsMock.mockResolvedValue(false);

    await upsertGitIgnore({
      context: mockContext,
      lines: [],
      path: gitignorePath
    });

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  test("handles file with only empty lines", async () => {
    const gitignorePath = join(testDir, GITIGNORE_FILENAME);
    const existingContent = "\n\n\n";
    const linesToAdd = [NODE_MODULES_ENTRY, LOG_FILES_ENTRY];

    // Create existing file with only empty lines
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    expect(writeFileMock).toHaveBeenCalledWith({
      contents: "node_modules/\n*.log\n",
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("preserves order of existing and new lines", async () => {
    const gitignorePath = join(testDir, ".gitignore");
    const existingContent = "node_modules/\n*.log\ntemp/\n";
    const linesToAdd = [".env", "dist/", "build/"];

    // Create existing file
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    expect(writeFileMock).toHaveBeenCalledWith({
      contents: "node_modules/\n*.log\ntemp/\n.env\ndist/\nbuild/\n",
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("handles complex gitignore patterns", async () => {
    const gitignorePath = join(testDir, ".gitignore");
    const existingContent = "# Node.js\nnode_modules/\n*.log\n";
    const linesToAdd = [
      "# Build outputs",
      "dist/",
      "build/",
      "*.tgz",
      "# Environment files", 
      ".env*",
      "!.env.example"
    ];

    // Create existing file
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    expect(writeFileMock).toHaveBeenCalledWith({
      contents: "# Node.js\nnode_modules/\n*.log\n# Build outputs\ndist/\nbuild/\n*.tgz\n# Environment files\n.env*\n!.env.example\n",
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("throws CLIError when writeFile fails", async () => {
    const gitignorePath = join(testDir, ".gitignore");
    const linesToAdd = ["node_modules/", "*.log"];

    fileExistsMock.mockResolvedValue(false);
    writeFileMock.mockRejectedValue(new Error("Write permission denied"));

    await expect(
      upsertGitIgnore({
        context: mockContext,
        lines: linesToAdd,
        path: gitignorePath
      })
    ).rejects.toThrow("Failed to update .gitignore");
  });

  test("handles special characters in gitignore patterns", async () => {
    const gitignorePath = join(testDir, ".gitignore");
    const linesToAdd = [
      "*.{tmp,temp}",
      "[Tt]emp/",
      "cache-*",
      "foo?bar",
      "**/*.backup"
    ];

    fileExistsMock.mockResolvedValue(false);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    expect(writeFileMock).toHaveBeenCalledWith({
      contents: "*.{tmp,temp}\n[Tt]emp/\ncache-*\nfoo?bar\n**/*.backup\n",
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("handles very long gitignore file efficiently", async () => {
    const gitignorePath = join(testDir, ".gitignore");
    
    // Create a large existing file with many entries
    const existingLines = Array.from({ length: 1000 }, (_, i) => `pattern-${i}`);
    const existingContent = existingLines.join("\n") + "\n";
    
    const linesToAdd = ["new-pattern-1", "new-pattern-2", "pattern-500"]; // One duplicate

    // Create existing file
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    // Should only add the two new patterns, not the duplicate
    const expectedContent = existingLines.join("\n") + "\nnew-pattern-1\nnew-pattern-2\n";
    expect(writeFileMock).toHaveBeenCalledWith({
      contents: expectedContent,
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("handles paths with special characters", async () => {
    const specialDir = join(testDir, "special dir with spaces");
    await mkdir(specialDir, { recursive: true });
    const gitignorePath = join(specialDir, ".gitignore");
    const linesToAdd = ["node_modules/"];

    fileExistsMock.mockResolvedValue(false);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    expect(writeFileMock).toHaveBeenCalledWith({
      contents: "node_modules/\n",
      context: mockContext,
      overwrite: true,
      filePath: gitignorePath
    });
  });

  test("calls logger.debug with appropriate messages", async () => {
    const gitignorePath = join(testDir, ".gitignore");
    const linesToAdd = ["node_modules/"];
    const debugSpy = spyOn(mockContext.logger, "debug");

    fileExistsMock.mockResolvedValue(false);
    writeFileMock.mockResolvedValue();

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    expect(debugSpy).toHaveBeenCalledWith("Updating .gitignore file", {
      linesToAdd: ["node_modules/"],
      path: gitignorePath
    });
    expect(debugSpy).toHaveBeenCalledWith("Updated .gitignore file", {
      path: gitignorePath
    });
  });

  test("calls logger.debug when no new lines to add", async () => {
    const gitignorePath = join(testDir, ".gitignore");
    const existingContent = "node_modules/\n";
    const linesToAdd = ["node_modules/"]; // Already exists
    const debugSpy = spyOn(mockContext.logger, "debug");

    // Create existing file
    await nodeWriteFile(gitignorePath, existingContent, "utf8");

    fileExistsMock.mockResolvedValue(true);

    await upsertGitIgnore({
      context: mockContext,
      lines: linesToAdd,
      path: gitignorePath
    });

    expect(debugSpy).toHaveBeenCalledWith("No new lines to add to .gitignore file", {
      path: gitignorePath
    });
  });
});