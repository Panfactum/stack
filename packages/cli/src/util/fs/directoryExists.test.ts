/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, mock, beforeEach, afterEach } from "bun:test";
import { directoryExists } from "./directoryExist";

let originalFile: typeof Bun.file;

beforeEach(() => {
    originalFile = Bun.file;
});

afterEach(() => {
    Bun.file = originalFile;
});

test("returns true if the directory exists", async () => {
    // Create a mock for the stat method
    const mockStat = mock(() => Promise.resolve({
        isDirectory: () => true
    }));

    // Mock Bun.file to return an object with our mocked stat method
    Bun.file = mock((_: string) => ({
        stat: mockStat
    })) as any;

    const result = await directoryExists({ path: "/some/directory" });

    expect(result).toBe(true);
    expect(Bun.file).toHaveBeenCalledWith("/some/directory");
    expect(mockStat).toHaveBeenCalled();
})

test("returns false if the directory does not exist", async () => {
    // Create a mock for the stat method
    const mockStat = mock(() => Promise.resolve({
        isDirectory: () => false
    }));

    // Mock Bun.file to return an object with our mocked stat method
    Bun.file = mock((_: string) => ({
        stat: mockStat
    })) as any;

    const result = await directoryExists({ path: "/some/directory" });

    expect(result).toBe(false);
    expect(Bun.file).toHaveBeenCalledWith("/some/directory");
    expect(mockStat).toHaveBeenCalled();
})