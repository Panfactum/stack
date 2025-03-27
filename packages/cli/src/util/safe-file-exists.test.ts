import { describe, it, expect, mock, spyOn } from "bun:test";
import { safeFileExists } from "./safe-file-exists";

// Mock Bun.file to simulate file existence
const mockFile = (exists: boolean) => ({
  exists: () => Promise.resolve(exists),
});

// Mock the global Bun object
mock.module("bun", () => ({
  file: (filePath: string) => mockFile(filePath === "/path/to/existing/file"),
}));

describe("safeFileExists", () => {
  it("should return true if the file exists", async () => {
    const result = await safeFileExists("/path/to/existing/file");
    expect(result).toBe(true);
  });

  it("should return false if the file does not exist", async () => {
    const result = await safeFileExists("/path/to/nonexistent/file");
    expect(result).toBe(false);
  });

  it("should return false if an error occurs", async () => {
    spyOn(Bun, "file").mockImplementation(() => {
      throw new Error("Test error");
    });
    const result = await safeFileExists("/path/to/error/file");
    expect(result).toBe(false);
  });
});
