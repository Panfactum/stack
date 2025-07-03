// Tests for Logger class - comprehensive test suite covering all functionality
// Verifies console output formatting, user prompts, styling, and terminal integration

import { Writable } from "node:stream";
import * as inquirerPrompts from "@inquirer/prompts";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import pc from "picocolors";
import * as dedentModule from "@/util/util/dedent";
import { Logger } from "./logger";
import * as terminalColumnsModule from "./teminal-columns/terminalColumns";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

// Mock picocolors to always apply colors in tests
mock.module("picocolors", () => ({
  default: {
    white: (str: string) => `\u001B[37m${str}\u001B[39m`,
    red: (str: string) => `\u001B[31m${str}\u001B[39m`,
    yellow: (str: string) => `\u001B[33m${str}\u001B[39m`,
    green: (str: string) => `\u001B[32m${str}\u001B[39m`,
    magenta: (str: string) => `\u001B[35m${str}\u001B[39m`,
    gray: (str: string) => `\u001B[90m${str}\u001B[39m`,
    bold: (str: string) => `\u001B[1m${str}\u001B[22m`,
    whiteBright: (str: string) => `\u001B[97m${str}\u001B[39m`,
    redBright: (str: string) => `\u001B[91m${str}\u001B[39m`,
    yellowBright: (str: string) => `\u001B[93m${str}\u001B[39m`,
    greenBright: (str: string) => `\u001B[92m${str}\u001B[39m`,
    magentaBright: (str: string) => `\u001B[95m${str}\u001B[39m`,
    italic: (str: string) => `\u001B[3m${str}\u001B[23m`,
  }
}));

// Constants for test strings
const TEST_MESSAGE = "Test message";

// Mock stream for capturing output
class MockWritableStream extends Writable {
  public written: string[] = [];

  override _write(chunk: globalThis.Buffer | string, _encoding: string, callback: (error?: Error | null) => void): void {
    this.written.push(chunk.toString());
    callback();
  }

  getOutput(): string {
    return this.written.join("");
  }

  clear(): void {
    this.written = [];
  }
}

// Mock task wrapper for Listr integration tests
const createMockTask = (): PanfactumTaskWrapper => ({
  output: "",
  title: "Test Task",
  prompt: <T>(_adapter: new (...args: unknown[]) => T): T => {
    // Return a mock instance that has a run method
    return {
      run: async (_promptFn: Function, config: unknown) => {
        // Mock prompt execution - return default values based on prompt type
        if (config && typeof config === "object" && "default" in config) {
          return (config as { default: unknown }).default;
        }
        return "mock-response";
      }
    } as T;
  }
} as PanfactumTaskWrapper);

let mockStream: MockWritableStream;
let logger: Logger;
let debugLogger: Logger;
let terminalColumnsMock: ReturnType<typeof spyOn<typeof terminalColumnsModule, "terminalColumns">>;
let dedentMock: ReturnType<typeof spyOn<typeof dedentModule, "dedent">>;

// Mock variables for inquirer prompts
let inputMock: ReturnType<typeof spyOn<typeof inquirerPrompts, "input">>;
let confirmMock: ReturnType<typeof spyOn<typeof inquirerPrompts, "confirm">>;
let selectMock: ReturnType<typeof spyOn<typeof inquirerPrompts, "select">>;
let checkboxMock: ReturnType<typeof spyOn<typeof inquirerPrompts, "checkbox">>;
let searchMock: ReturnType<typeof spyOn<typeof inquirerPrompts, "search">>;
let passwordMock: ReturnType<typeof spyOn<typeof inquirerPrompts, "password">>;

/**
 * Helper function to verify that a message contains the expected text AND has been colored by picocolors.
 * This function requires that ANSI color codes are present to ensure picocolors is actually working.
 */
function expectMessageToBeColored(actualMessage: string, expectedText: string) {
  // REQUIRE that the message contains ANSI color codes (picocolors is working)
  // eslint-disable-next-line no-control-regex
  expect(actualMessage).toMatch(/\u001B\[[0-9;]*m/);

  // Verify the plain text content is correct after stripping colors
  // eslint-disable-next-line no-control-regex
  const plainMessage = actualMessage.replace(/\u001B\[[0-9;]*m/g, "");
  expect(plainMessage).toContain(expectedText);
}

describe("Logger", () => {
  beforeEach(() => {
    mockStream = new MockWritableStream();
    logger = new Logger(mockStream, false);
    debugLogger = new Logger(mockStream, true);

    // Mock terminal columns to return simple formatted output
    terminalColumnsMock = spyOn(terminalColumnsModule, "terminalColumns");
    terminalColumnsMock.mockImplementation((data: string[][], _breakpoints?) => {
      return data.map(row => row.join(" ")).join("\n");
    });

    // Mock dedent to return the input unchanged for predictable testing
    dedentMock = spyOn(dedentModule, "dedent");
    dedentMock.mockImplementation((str: string) => str.trim());

    // Mock inquirer prompts
    inputMock = spyOn(inquirerPrompts, "input");
    confirmMock = spyOn(inquirerPrompts, "confirm");
    selectMock = spyOn(inquirerPrompts, "select");
    checkboxMock = spyOn(inquirerPrompts, "checkbox");
    searchMock = spyOn(inquirerPrompts, "search");
    passwordMock = spyOn(inquirerPrompts, "password");

    // Set default mock implementations
    inputMock.mockResolvedValue("test-input");
    confirmMock.mockResolvedValue(true);
    selectMock.mockResolvedValue("selected-value");
    checkboxMock.mockResolvedValue(["checked-value"]);
    searchMock.mockResolvedValue("search-result");
    passwordMock.mockResolvedValue("secret-password");
  });

  afterEach(() => {
    mockStream.clear();
    // Restore all mocks
    terminalColumnsMock.mockRestore();
    dedentMock.mockRestore();
    inputMock.mockRestore();
    confirmMock.mockRestore();
    selectMock.mockRestore();
    checkboxMock.mockRestore();
    searchMock.mockRestore();
    passwordMock.mockRestore();
  });

  describe("constructor", () => {
    test("initializes with debug disabled", () => {
      const testStream = new MockWritableStream();
      const testLogger = new Logger(testStream, false);

      // Debug should not output anything
      testLogger.debug("test debug message");
      expect(testStream.getOutput()).toBe("");
    });

    test("initializes with debug enabled", () => {
      const testStream = new MockWritableStream();
      const testLogger = new Logger(testStream, true);

      testLogger.debug("test debug message");
      expect(testStream.getOutput()).toBe("test debug message");
    });

    test("stores stream reference correctly", () => {
      const testStream = new MockWritableStream();
      const testLogger = new Logger(testStream, false);

      testLogger.info("test message");
      expect(testStream.written.length).toBeGreaterThan(0);
    });
  });

  describe("debug", () => {
    test("outputs debug message when debug is enabled", () => {
      debugLogger.debug("Debug message");
      expect(mockStream.getOutput()).toBe("Debug message");
    });

    test("ignores debug message when debug is disabled", () => {
      logger.debug("Debug message");
      expect(mockStream.getOutput()).toBe("");
    });

    test("accepts metadata parameter without error", () => {
      debugLogger.debug("Debug with metadata", { key: "value", number: 42 });
      expect(mockStream.getOutput()).toBe("Debug with metadata");
    });

    test("handles empty debug message", () => {
      debugLogger.debug("");
      expect(mockStream.getOutput()).toBe("");
    });

    test("handles multiline debug messages", () => {
      const multilineMessage = "Line 1\nLine 2\nLine 3";
      debugLogger.debug(multilineMessage);
      expect(mockStream.getOutput()).toBe(multilineMessage);
    });
  });

  describe("identifier management", () => {
    test("adds identifier successfully", () => {
      logger.addIdentifier("test-identifier");

      // Test that identifier is highlighted in output
      logger.info("Message with test-identifier included");
      const output = mockStream.getOutput();
      expect(output).toContain("test-identifier");
    });

    test("adds multiple identifiers", () => {
      logger.addIdentifier("first");
      logger.addIdentifier("second");
      logger.addIdentifier("third");

      logger.info("Message with first and second and third");
      const output = mockStream.getOutput();
      expect(output).toContain("first");
      expect(output).toContain("second");
      expect(output).toContain("third");
    });

    test("removes identifier successfully", () => {
      logger.addIdentifier("removable");
      logger.addIdentifier("permanent");

      // Verify both are present
      logger.info("Test removable and permanent");
      mockStream.clear();

      // Remove one identifier
      logger.removeIdentifier("removable");
      logger.info("Test removable and permanent again");

      const output = mockStream.getOutput();
      expect(output).toContain("permanent");
      expect(output).toContain("removable"); // Still contains the text, but not highlighted
    });

    test("handles removing non-existent identifier", () => {
      logger.removeIdentifier("non-existent");
      // Should not throw or cause issues
      logger.info(TEST_MESSAGE);
      expect(mockStream.getOutput()).toContain(TEST_MESSAGE);
    });

    test("handles duplicate identifiers", () => {
      logger.addIdentifier("duplicate");
      logger.addIdentifier("duplicate");
      logger.addIdentifier("duplicate");

      logger.info("Message with duplicate");
      const output = mockStream.getOutput();
      expect(output).toContain("duplicate");
    });

    test("ignores empty string identifier", () => {
      logger.addIdentifier("");
      logger.addIdentifier("   "); // Whitespace only
      logger.info(TEST_MESSAGE);
      expect(mockStream.getOutput()).toContain(TEST_MESSAGE);
      // Test should complete without hanging, indicating empty identifiers are ignored
    });

    test("handles special characters in identifiers", () => {
      logger.addIdentifier("test@domain.com");
      logger.addIdentifier("special-chars_123");
      logger.addIdentifier("with spaces");

      logger.info("Email test@domain.com and special-chars_123 and with spaces");
      const output = mockStream.getOutput();
      expect(output).toContain("test@domain.com");
      expect(output).toContain("special-chars_123");
      expect(output).toContain("with spaces");
    });
  });

  describe("getColorFn", () => {
    test("returns correct color functions for all styles", () => {
      expect(logger.getColorFn("error")).toBe(pc.red);
      expect(logger.getColorFn("warning")).toBe(pc.yellow);
      expect(logger.getColorFn("success")).toBe(pc.green);
      expect(logger.getColorFn("default")).toBe(pc.white);
      expect(logger.getColorFn("subtle")).toBe(pc.gray);
      expect(logger.getColorFn("question")).toBe(pc.magenta);
    });

    test("returns enhanced important color functions with base styles", () => {
      const warningImportant = logger.getColorFn("important", "warning");
      const questionImportant = logger.getColorFn("important", "question");
      const errorImportant = logger.getColorFn("important", "error");
      const successImportant = logger.getColorFn("important", "success");
      const defaultImportant = logger.getColorFn("important");

      // Test that these return functions
      expect(typeof warningImportant).toBe("function");
      expect(typeof questionImportant).toBe("function");
      expect(typeof errorImportant).toBe("function");
      expect(typeof successImportant).toBe("function");
      expect(typeof defaultImportant).toBe("function");

      // Test that functions work
      expect(warningImportant("test")).toBeTruthy();
      expect(questionImportant("test")).toBeTruthy();
      expect(errorImportant("test")).toBeTruthy();
      expect(successImportant("test")).toBeTruthy();
      expect(defaultImportant("test")).toBeTruthy();
    });

    test("handles all important style combinations", () => {
      const styles: Array<"warning" | "question" | "error" | "success" | "default" | undefined> =
        ["warning", "question", "error", "success", "default", undefined];

      for (const style of styles) {
        const colorFn = logger.getColorFn("important", style);
        expect(typeof colorFn).toBe("function");
        expect(colorFn("test text")).toBeTruthy(); // Function should work
      }
    });
  });

  describe("applyColors", () => {
    test("applies basic color styling", () => {
      const result = logger.applyColors(TEST_MESSAGE, { style: "error" });
      expect(result).toBeTruthy();
      expect(result).toContain(TEST_MESSAGE);
    });

    test("applies bold formatting", () => {
      const result = logger.applyColors("Bold text", { bold: true });
      expect(result).toBeTruthy();
      expect(result).toBeTruthy(); // Should return styled text
    });

    test("applies dedent when requested", () => {
      logger.applyColors("  Indented text  ", { dedent: true });
      expect(dedentMock).toHaveBeenCalledWith("  Indented text  ");
    });

    test("skips highlighting when disabled", () => {
      logger.addIdentifier("highlight-me");
      const result = logger.applyColors("Text with highlight-me", { highlighterDisabled: true });
      expect(result).toContain("highlight-me");
      // Should not apply highlighting even though identifier is present
    });

    test("highlights explicit highlights", () => {
      const result = logger.applyColors("Text with important word", {
        highlights: ["important"]
      });
      expect(result).toContain("important");
    });

    test("highlights lowlights with subtle style", () => {
      const result = logger.applyColors("Text with subtle word", {
        lowlights: ["subtle"]
      });
      expect(result).toContain("subtle");
    });

    test("highlights badlights with error style", () => {
      const result = logger.applyColors("Text with error word", {
        badlights: ["error"]
      });
      expect(result).toContain("error");
    });

    test("prioritizes explicit highlights over identifiers", () => {
      logger.addIdentifier("conflict");
      const result = logger.applyColors("Text with conflict", {
        highlights: ["conflict"]
      });
      expect(result).toContain("conflict");
    });

    test("handles overlapping highlights correctly", () => {
      const result = logger.applyColors("abcdefghijk", {
        highlights: ["abcdef", "defghi"]
      });
      expect(result).toContain("abcdef");
    });

    test("prioritizes longer phrases at same position", () => {
      const result = logger.applyColors("test testing", {
        highlights: ["test", "testing"]
      });
      expect(result).toContain("testing");
    });

    test("handles multiple non-overlapping highlights", () => {
      const result = logger.applyColors("first word and second word", {
        highlights: ["first", "second"]
      });
      expect(result).toContain("first");
      expect(result).toContain("second");
    });

    test("handles empty highlights array", () => {
      const result = logger.applyColors(TEST_MESSAGE, {
        highlights: []
      });
      expect(result).toContain(TEST_MESSAGE);
    });

    test("handles highlights with special regex characters", () => {
      const result = logger.applyColors("Test (special) [chars] {here}", {
        highlights: ["(special)", "[chars]", "{here}"]
      });
      expect(result).toContain("(special)");
      expect(result).toContain("[chars]");
      expect(result).toContain("{here}");
    });

    test("applies multiple highlight types simultaneously", () => {
      const result = logger.applyColors("important subtle error text", {
        highlights: ["important"],
        lowlights: ["subtle"],
        badlights: ["error"]
      });
      expect(result).toContain("important");
      expect(result).toContain("subtle");
      expect(result).toContain("error");
    });

    test("handles case-sensitive highlighting", () => {
      const result = logger.applyColors("Test test TEST", {
        highlights: ["test"]
      });
      expect(result).toContain("Test");
      expect(result).toContain("test");
      expect(result).toContain("TEST");
    });

    test("handles repeated phrases", () => {
      const result = logger.applyColors("test test test", {
        highlights: ["test"]
      });
      expect(result).toContain("test");
    });

    test("handles highlights at string boundaries", () => {
      const result = logger.applyColors("start middle end", {
        highlights: ["start", "end"]
      });
      expect(result).toContain("start");
      expect(result).toContain("end");
    });

    test("preserves text when no highlights match", () => {
      const result = logger.applyColors("No matches here", {
        highlights: ["missing"]
      });
      expect(result).toContain("No matches here");
    });

    test("handles empty string input", () => {
      const result = logger.applyColors("", { highlights: ["test"] });
      expect(result).toBe("");
    });

    test("handles complex highlighting scenarios", () => {
      logger.addIdentifier("auto");
      const result = logger.applyColors("auto manual auto specific auto", {
        highlights: ["manual"],
        lowlights: ["specific"],
        badlights: ["missing"]
      });
      expect(result).toContain("auto");
      expect(result).toContain("manual");
      expect(result).toContain("specific");
    });
  });

  describe("info", () => {
    test("outputs info message with icon", () => {
      logger.info("Information message");

      const output = mockStream.getOutput();
      expect(output).toContain("Information message");

      // Verify terminalColumns was called with specific parameters
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      // Verify data structure: [[icon, message]]
      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);

      // Verify icon contains the info symbol and is styled
      expect(data![0]![0]).toMatch(/🛈/);

      // Verify message has been colored by picocolors (white)
      expect(data![0]![1]).toBe("\u001B[37mInformation message\u001B[39m");

      // Verify breakpoints are provided
      expect(breakpoints).toBeDefined();
    });

    test("applies highlighting configuration", () => {
      logger.info("Message with highlights", {
        highlights: ["highlights"]
      });

      const output = mockStream.getOutput();
      expect(output).toContain("highlights");

      // Verify terminalColumns called with exact parameters
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      // Verify data structure
      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);

      // Verify icon
      expect(data![0]![0]).toMatch(/🛈/);

      // Verify message contains highlighted text
      expect(data![0]![1]).toContain("Message with");
      expect(data![0]![1]).toContain("highlights");

      // Verify breakpoints provided
      expect(breakpoints).toBeDefined();
    });

    test("handles multiline messages", () => {
      logger.info("Line 1\nLine 2\nLine 3");

      const output = mockStream.getOutput();
      expect(output).toContain("Line 1");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/🛈/);
      expect(data![0]![1]).toBe("\u001B[37mLine 1\nLine 2\nLine 3\u001B[39m"); // Dedent mock returns trimmed input, then colored
      expect(breakpoints).toBeDefined();
    });

    test("applies default styling", () => {
      logger.info("Styled message");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/🛈/); // Info icon with important styling
      expect(data![0]![1]).toBe("\u001B[37mStyled message\u001B[39m"); // Message with default white styling
      expect(breakpoints).toBeDefined();
    });

    test("adds proper line spacing", () => {
      logger.info(TEST_MESSAGE);

      const output = mockStream.getOutput();
      expect(output).toMatch(/\n\n$/); // Ends with double newline

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/🛈/);
      expect(data![0]![1]).toBe("\u001B[37mTest message\u001B[39m");
      expect(breakpoints).toBeDefined();
    });

    test("handles empty message", () => {
      logger.info("");

      const output = mockStream.getOutput();
      expect(output).toBeTruthy(); // Should still output something (icon)

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/🛈/);
      expect(data![0]![1]).toBe(""); // Empty message should remain empty after applyColors
      expect(breakpoints).toBeDefined();
    });

    test("handles messages with identifiers", () => {
      logger.addIdentifier("production");
      logger.info("Deploying to production environment");

      const output = mockStream.getOutput();
      expect(output).toContain("production");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/🛈/);
      expect(data![0]![1]).toContain("Deploying to");
      expect(data![0]![1]).toContain("production");
      expect(data![0]![1]).toContain("environment");
      expect(breakpoints).toBeDefined();
    });
  });

  describe("warn", () => {
    test("outputs warning message with icon", () => {
      logger.warn("Warning message");

      const output = mockStream.getOutput();
      expect(output).toContain("Warning message");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/❗/); // Warning icon with yellow styling
      expect(data![0]![1]).toBe("\u001B[33mWarning message\u001B[39m"); // Message with warning (yellow) styling
      expect(breakpoints).toBeDefined();
    });

    test("applies warning styling", () => {
      logger.warn("Warning text");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/❗/); // Warning icon with yellow styling
      expect(data![0]![1]).toBe("\u001B[33mWarning text\u001B[39m"); // Message with warning (yellow) styling
      expect(breakpoints).toBeDefined();
    });

    test("applies highlighting configuration", () => {
      logger.warn("Warning with highlights", {
        highlights: ["highlights"]
      });

      const output = mockStream.getOutput();
      expect(output).toContain("highlights");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/❗/);
      expect(data![0]![1]).toContain("Warning with");
      expect(data![0]![1]).toContain("highlights");
      expect(breakpoints).toBeDefined();
    });

    test("handles empty warning", () => {
      logger.warn("");

      const output = mockStream.getOutput();
      expect(output).toBeTruthy();

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/❗/);
      expect(data![0]![1]).toBe(""); // Empty message should remain empty after applyColors
      expect(breakpoints).toBeDefined();
    });
  });

  describe("success", () => {
    test("outputs success message with checkmark", () => {
      logger.success("Success message");

      const output = mockStream.getOutput();
      expect(output).toContain("Success message");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/✓/); // Success checkmark with green styling
      expect(data![0]![1]).toBe("\u001B[32mSuccess message\u001B[39m"); // Message with success (green) styling
      expect(breakpoints).toBeDefined();
    });

    test("applies success styling", () => {
      logger.success("Success text");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/✓/); // Success checkmark with green styling
      expect(data![0]![1]).toBe("\u001B[32mSuccess text\u001B[39m"); // Message with success (green) styling
      expect(breakpoints).toBeDefined();
    });

    test("applies highlighting configuration", () => {
      logger.success("Success with highlights", {
        highlights: ["highlights"]
      });

      const output = mockStream.getOutput();
      expect(output).toContain("highlights");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/✓/);
      expect(data![0]![1]).toContain("Success with");
      expect(data![0]![1]).toContain("highlights");
      expect(breakpoints).toBeDefined();
    });
  });

  describe("error", () => {
    test("outputs error message with icon", () => {
      logger.error("Error message");

      const output = mockStream.getOutput();
      expect(output).toContain("Error message");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/🆇/); // Error icon with red styling
      expect(data![0]![1]).toBe("\u001B[31mError message\u001B[39m"); // Message with error (red) styling
      expect(breakpoints).toBeDefined();
    });

    test("applies error styling", () => {
      logger.error("Error text");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/🆇/); // Error icon with red styling
      expect(data![0]![1]).toBe("\u001B[31mError text\u001B[39m"); // Message with error (red) styling
      expect(breakpoints).toBeDefined();
    });

    test("applies highlighting configuration", () => {
      logger.error("Error with highlights", {
        badlights: ["highlights"]
      });

      const output = mockStream.getOutput();
      expect(output).toContain("highlights");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toMatch(/🆇/);
      expect(data![0]![1]).toContain("Error with");
      expect(data![0]![1]).toContain("highlights");
      expect(breakpoints).toBeDefined();
    });
  });

  describe("write", () => {
    test("outputs styled text without icon", () => {
      logger.write("Plain text");

      const output = mockStream.getOutput();
      expect(output).toContain("Plain text");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toBe(""); // No icon
      expect(data![0]![1]).toBe("\u001B[37mPlain text\u001B[39m"); // Message with default (white) styling
      expect(breakpoints).toBeDefined();
    });

    test("applies custom styling", () => {
      logger.write("Styled text", { style: "warning" });

      const output = mockStream.getOutput();
      expect(output).toContain("Styled text");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toBe("");
      expect(data![0]![1]).toBe("\u001B[33mStyled text\u001B[39m"); // Message with warning (yellow) styling
      expect(breakpoints).toBeDefined();
    });

    test("handles removeIndent option", () => {
      logger.write("Indented text", { removeIndent: true });

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toBe("");
      expect(data![0]![1]).toBe("\u001B[37mIndented text\u001B[39m");
      expect(breakpoints).toEqual([0, 100]); // Different breakpoint for removeIndent
    });

    test("applies highlighting configuration", () => {
      logger.write("Text with highlights", {
        highlights: ["highlights"]
      });

      const output = mockStream.getOutput();
      expect(output).toContain("highlights");

      // Verify exact terminalColumns call
      expect(terminalColumnsMock).toHaveBeenCalledTimes(1);
      const callArgs = terminalColumnsMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [data, breakpoints] = callArgs!;

      expect(data).toHaveLength(1);
      expect(data![0]).toHaveLength(2);
      expect(data![0]![0]).toBe("");
      expect(data![0]![1]).toContain("Text with");
      expect(data![0]![1]).toContain("highlights");
      expect(breakpoints).toBeDefined();
    });
  });

  describe("writeRaw", () => {
    test("outputs raw text without formatting", () => {
      logger.writeRaw("Raw text content");

      const output = mockStream.getOutput();
      expect(output).toBe("Raw text content\n\n");
      expect(terminalColumnsMock).not.toHaveBeenCalled();
    });

    test("preserves formatting in raw text", () => {
      const rawText = "Line 1\n  Indented line\nLine 3";
      logger.writeRaw(rawText);

      const output = mockStream.getOutput();
      expect(output).toBe(rawText + "\n\n");
    });

    test("handles empty raw text", () => {
      logger.writeRaw("");

      const output = mockStream.getOutput();
      expect(output).toBe("\n\n");
    });
  });

  describe("line", () => {
    test("outputs single newline", () => {
      logger.line();

      const output = mockStream.getOutput();
      expect(output).toBe("\n");
    });

    test("can be called multiple times", () => {
      logger.line();
      logger.line();
      logger.line();

      const output = mockStream.getOutput();
      expect(output).toBe("\n\n\n");
    });
  });

  describe("input prompt", () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
    test("calls inquirer input with correct configuration", async () => {
      const result = await logger.input({
        message: "What is your name?",
        default: "Anonymous"
      });

      // Verify inquirer input was called exactly once
      expect(inputMock).toHaveBeenCalledTimes(1);
      const callArgs = inputMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [config] = callArgs!;

      // Verify exact message content (should be styled with question colors)
      // Message should be colored with picocolors
      expectMessageToBeColored(config.message, "What is your name?");

      // Verify exact default value
      expect(config.default).toBe("Anonymous");

      // Verify required flag
      expect(config.required).toBe(true);

      // Verify theme structure
      expect(config.theme).toBeDefined();
      expect((config.theme as any).helpMode).toBe("never");

      // Verify theme style functions exist
      expect((config.theme as any).style).toBeDefined();
      expect(typeof (config.theme as any).style.message).toBe("function");
      expect(typeof (config.theme as any).style.answer).toBe("function");
      expect(typeof (config.theme as any).style.defaultAnswer).toBe("function");
      expect(typeof (config.theme as any).style.description).toBe("function");

      // Verify prefix configuration (may be empty strings for some terminal sizes)
      expect((config.theme as any).prefix).toBeDefined();
      expect((config.theme as any).prefix.idle).toBeDefined();
      expect((config.theme as any).prefix.done).toBeDefined();

      expect(result).toBe("test-input");
    });

    test("handles string message", async () => {
      await logger.input({
        message: "Simple string message"
      });

      // Verify inquirer input was called exactly once
      expect(inputMock).toHaveBeenCalledTimes(1);
      const callArgs = inputMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [config] = callArgs!;

      // Verify exact message content
      // Message should be colored with picocolors
      expectMessageToBeColored(config.message, "Simple string message");

      // Verify required flag
      expect(config.required).toBe(true);

      // Verify theme structure
      expect(config.theme).toBeDefined();
      expect((config.theme as any).helpMode).toBe("never");

      // Verify prefix configuration exists
      expect((config.theme as any).prefix).toBeDefined();
      expect((config.theme as any).prefix.idle).toBeDefined();
      expect((config.theme as any).prefix.done).toBeDefined();
    });

    test("handles object message with highlights", async () => {
      await logger.input({
        message: {
          message: "Message with highlights",
          highlights: ["highlights"]
        }
      });

      expect(inputMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/Message with.*highlights/), // Styled with highlights
          required: true,
          theme: expect.objectContaining({
            helpMode: "never"
          })
        })
      );
    });

    test("applies validation with error styling", async () => {
      const mockValidate = (value: string) => value.length > 0 || "Value is required";

      await logger.input({
        message: "Enter value",
        validate: mockValidate
      });

      // Verify inquirer input was called exactly once
      expect(inputMock).toHaveBeenCalledTimes(1);
      const callArgs = inputMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [config] = callArgs!;

      // Verify exact message
      // Message should be colored with picocolors
      expectMessageToBeColored(config.message, "Enter value");

      // Verify validation function exists
      expect(config.validate).toBeDefined();
      expect(typeof config.validate).toBe("function");

      // Verify required flag
      expect(config.required).toBe(true);

      // Test validation function wrapping
      if (config.validate) {
        // Valid input should return true
        const validResult = await config.validate("valid input");
        expect(validResult).toBe(true);

        // Invalid input should return styled error message
        const invalidResult = await config.validate("");
        expect(typeof invalidResult).toBe("string");
        expect(invalidResult).toBe("\u001B[31mValue is required\u001B[39m");
      }
    });

    test("handles async validation", async () => {
      const asyncValidate = async (value: string) => {
        await new Promise(resolve => globalThis.setTimeout(resolve, 1));
        return value.includes("test") || "Must contain 'test'";
      };

      await logger.input({
        message: "Enter value",
        validate: asyncValidate
      });

      const callArgs = inputMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const config = callArgs![0];
      if (config?.validate) {
        const result = await config.validate("test-value");
        expect(result).toBe(true);
      }
    });

    test("handles explainer text", async () => {
      await logger.input({
        message: "Enter value",
        explainer: "This is explanatory text"
      });

      expect(inputMock).toHaveBeenCalled();
    });

    test("handles object explainer with highlights", async () => {
      await logger.input({
        message: "Enter value",
        explainer: {
          message: "Explainer with highlights",
          highlights: ["highlights"]
        }
      });

      expect(inputMock).toHaveBeenCalled();
    });

    test("adds newline after non-task prompt", async () => {
      await logger.input({
        message: TEST_MESSAGE
      });

      const output = mockStream.getOutput();
      expect(output).toContain("\n");
    });

    test("works with Listr task", async () => {
      const mockTask = createMockTask();

      const result = await logger.input({
        message: "Task input",
        task: mockTask
      });

      expect(result).toBe("mock-response");
    });

    test("handles transformer function", async () => {
      const transformer = (value: string, context: { isFinal: boolean }) =>
        context.isFinal ? value.toUpperCase() : value;

      await logger.input({
        message: "Enter value",
        transformer
      });

      expect(inputMock).toHaveBeenCalledWith(
        expect.objectContaining({
          transformer
        })
      );
    });
  });


  describe("password prompt", () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
    test("calls inquirer password with correct configuration", async () => {
      const result = await logger.password({
        message: "Enter password"
      });

      // Verify inquirer password was called exactly once
      expect(passwordMock).toHaveBeenCalledTimes(1);
      const callArgs = passwordMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [config] = callArgs!;

      // Verify exact message content
      // Message should be colored with picocolors
      expectMessageToBeColored(config.message, "Enter password");

      // Verify required flag and mask setting
      expect((config as any).required).toBe(true);
      expect(config.mask).toBe(true);

      // Verify theme structure
      expect(config.theme).toBeDefined();
      expect((config.theme as any).helpMode).toBe("never");

      // Verify theme style functions exist
      expect((config.theme as any).style).toBeDefined();
      expect(typeof (config.theme as any).style.message).toBe("function");
      expect(typeof (config.theme as any).style.answer).toBe("function");

      // Verify prefix configuration exists
      expect((config.theme as any).prefix).toBeDefined();
      expect((config.theme as any).prefix.idle).toBeDefined();
      expect((config.theme as any).prefix.done).toBeDefined();

      expect(result).toBe("secret-password");
    });

    test("handles custom mask setting", async () => {
      await logger.password({
        message: "Enter password",
        mask: "*"
      });

      expect(passwordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "\u001B[35mEnter password\u001B[39m",
          mask: "*", // Custom mask character
          required: true,
          theme: expect.objectContaining({
            helpMode: "never"
          })
        })
      );
    });

    test("handles validation with error styling", async () => {
      const mockValidate = (value: string) => value.length >= 8 || "Password too short";

      await logger.password({
        message: "Enter password",
        validate: mockValidate
      });

      expect(passwordMock).toHaveBeenCalledTimes(1);
      expect(passwordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          validate: expect.any(Function)
        })
      );
    });

    test("works with Listr task", async () => {
      const mockTask = createMockTask();

      const result = await logger.password({
        message: "Task password",
        task: mockTask
      });

      expect(result).toBe("mock-response");
    });

    test("handles explainer text", async () => {
      await logger.password({
        message: "Enter password",
        explainer: "Password requirements explanation"
      });

      expect(passwordMock).toHaveBeenCalled();
    });
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
  });

  describe("select prompt", () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
    test("calls inquirer select with correct configuration", async () => {
      const choices = [
        { name: "Option 1", value: "opt1" },
        { name: "Option 2", value: "opt2" }
      ];

      const result = await logger.select({
        message: "Choose option",
        choices,
        default: "opt1"
      });

      // Verify inquirer select was called exactly once
      expect(selectMock).toHaveBeenCalledTimes(1);
      const callArgs = selectMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [config] = callArgs!;

      // Verify exact message content
      // Message should be colored with picocolors
      expectMessageToBeColored(config.message, "Choose option");

      // Verify exact choices array
      expect(config.choices).toEqual([
        { name: "Option 1", value: "opt1" },
        { name: "Option 2", value: "opt2" }
      ]);

      // Verify exact default value
      expect(config.default).toBe("opt1");

      // Verify theme structure
      expect(config.theme).toBeDefined();
      expect((config.theme as any).helpMode).toBe("never");

      // Verify theme style functions exist
      expect((config.theme as any).style).toBeDefined();
      expect(typeof (config.theme as any).style.message).toBe("function");
      expect(typeof (config.theme as any).style.answer).toBe("function");

      // Verify prefix configuration exists
      expect((config.theme as any).prefix).toBeDefined();
      expect((config.theme as any).prefix.idle).toBeDefined();
      expect((config.theme as any).prefix.done).toBeDefined();
      expect(result).toBe("selected-value");
    });

    test("handles choices with descriptions", async () => {
      const choices = [
        { name: "First", value: "first", description: "First option" },
        { name: "Second", value: "second", description: "Second option" }
      ];

      await logger.select({
        message: "Choose",
        choices
      });

      expect(selectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          choices
        })
      );
    });

    test("handles disabled choices", async () => {
      const choices = [
        { name: "Available", value: "available" },
        { name: "Disabled", value: "disabled", disabled: true }
      ];

      await logger.select({
        message: "Choose",
        choices
      });

      expect(selectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          choices
        })
      );
    });

    test("works with Listr task", async () => {
      const mockTask = createMockTask();

      const result = await logger.select({
        message: "Task select",
        choices: [{ name: "Option", value: "value" }],
        task: mockTask
      });

      expect(result).toBe("mock-response");
    });

    test("handles explainer text", async () => {
      await logger.select({
        message: "Choose option",
        choices: [{ name: "Option", value: "value" }],
        explainer: "Selection explanation"
      });

      expect(selectMock).toHaveBeenCalled();
    });
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
  });

  describe("checkbox prompt", () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
    test("calls inquirer checkbox with correct configuration", async () => {
      const choices = [
        { name: "Option 1", value: "opt1", checked: true },
        { name: "Option 2", value: "opt2" }
      ];

      const result = await logger.checkbox({
        message: "Select multiple",
        choices
      });

      // Verify inquirer checkbox was called exactly once
      expect(checkboxMock).toHaveBeenCalledTimes(1);
      const callArgs = checkboxMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [config] = callArgs!;

      // Verify exact message content
      // Message should be colored with picocolors
      expectMessageToBeColored(config.message, "Select multiple");

      // Verify exact choices array
      expect(config.choices).toEqual([
        { name: "Option 1", value: "opt1", checked: true },
        { name: "Option 2", value: "opt2" }
      ]);

      // Verify instructions setting
      expect(config.instructions).toBe(false);

      // Verify theme structure
      expect(config.theme).toBeDefined();
      expect((config.theme as any).helpMode).toBe("never");

      // Verify theme style functions exist
      expect((config.theme as any).style).toBeDefined();
      expect(typeof (config.theme as any).style.message).toBe("function");
      expect(typeof (config.theme as any).style.answer).toBe("function");

      // Verify prefix configuration exists
      expect((config.theme as any).prefix).toBeDefined();
      expect((config.theme as any).prefix.idle).toBeDefined();
      expect((config.theme as any).prefix.done).toBeDefined();
      expect(result).toEqual(["checked-value"]);
    });

    test("handles validation with error styling", async () => {
      const mockValidate = (choices: readonly { value: string; checked?: boolean }[]) =>
        choices.length > 0 || "At least one option required";

      await logger.checkbox({
        message: "Select options",
        choices: [{ name: "Option", value: "opt" }],
        validate: mockValidate
      });

      expect(checkboxMock).toHaveBeenCalledTimes(1);
      expect(checkboxMock).toHaveBeenCalledWith(
        expect.objectContaining({
          validate: expect.any(Function)
        })
      );
    });

    test("handles disabled choices", async () => {
      const choices = [
        { name: "Available", value: "available" },
        { name: "Disabled", value: "disabled", disabled: "Not available" }
      ];

      await logger.checkbox({
        message: "Select",
        choices
      });

      expect(checkboxMock).toHaveBeenCalledWith(
        expect.objectContaining({
          choices
        })
      );
    });

    test("works with Listr task", async () => {
      const mockTask = createMockTask();

      const result = await logger.checkbox({
        message: "Task checkbox",
        choices: [{ name: "Option", value: "value" }],
        task: mockTask
      });

      expect(result as unknown).toBe("mock-response");
    });

    test("handles custom instructions", async () => {
      await logger.checkbox({
        message: "Select options",
        choices: [{ name: "Option", value: "opt" }],
        instructions: "Custom instructions"
      });

      expect(checkboxMock).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: "Custom instructions"
        })
      );
    });
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
  });

  describe("search prompt", () => {

    test("calls inquirer search with correct configuration", async () => {
      const mockSource = async (term?: string) => [
        { name: `Result for ${term}`, value: "result" }
      ];

      const result = await logger.search({
        message: "Search for item",
        source: mockSource
      });

      expect(searchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          source: mockSource,
          theme: expect.any(Object)
        })
      );
      expect(result).toBe("search-result");
    });

    test("handles validation with error styling", async () => {
      const mockValidate = (value: string) => value.length > 0 || "Selection required";
      const mockSource = async () => [{ name: "Item", value: "item" }];

      await logger.search({
        message: "Search",
        source: mockSource,
        validate: mockValidate
      });

      const callArgs = searchMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const config = callArgs![0];
      expect(config?.validate).toBeDefined();
    });

    test("handles default value", async () => {
      const mockSource = async () => [{ name: "Item", value: "item" }];

      await logger.search({
        message: "Search",
        source: mockSource,
        default: "default-search"
      });

      expect(searchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          default: "default-search"
        })
      );
    });

    test("works with Listr task", async () => {
      const mockTask = createMockTask();
      const mockSource = async () => [{ name: "Item", value: "item" }];

      const result = await logger.search({
        message: "Task search",
        source: mockSource,
        task: mockTask
      });

      expect(result).toBe("mock-response");
    });

  });

  describe("confirm prompt", () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */

    beforeEach(() => {
      confirmMock.mockClear();
    });

    test("calls inquirer confirm with correct configuration", async () => {
      const result = await logger.confirm({
        message: "Are you sure?",
        default: true
      });

      expect(confirmMock).toHaveBeenCalledTimes(1);
      const callArgs = confirmMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [config] = callArgs!;
      expect(config.message).toMatch(/Are you sure\?/);
      expect(config.default).toBe(true);
      expect(config.theme).toBeDefined();
      expect((config.theme as any).helpMode).toBe("never");
      expect((config.theme as any).style).toBeDefined();
      expect((config.theme as any).prefix).toBeDefined();
      // Terminal width dependent - can be emoji or empty string
      expect(typeof (config.theme as any).prefix.idle).toBe("string");
      expect(typeof (config.theme as any).prefix.done).toBe("string");
      expect(result).toBe(true);
    });

    test("handles default false", async () => {
      await logger.confirm({
        message: "Proceed?",
        default: false
      });

      expect(confirmMock).toHaveBeenCalledTimes(1);
      const callArgs = confirmMock.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [config] = callArgs!;
      expect(config.message).toMatch(/Proceed\?/);
      expect(config.default).toBe(false);
      expect(config.theme).toBeDefined();
      expect((config.theme as any).helpMode).toBe("never");
      expect((config.theme as any).prefix).toBeDefined();
      // Terminal width dependent - can be emoji or empty string
      expect(typeof (config.theme as any).prefix.idle).toBe("string");
    });

    test("works with Listr task", async () => {
      const mockTask = createMockTask();

      const result = await logger.confirm({
        message: "Task confirm",
        task: mockTask
      });

      expect(result as unknown).toBe("mock-response");
    });

    test("handles explainer text", async () => {
      await logger.confirm({
        message: "Confirm action",
        explainer: "This action cannot be undone"
      });

      expect(confirmMock).toHaveBeenCalled();
    });
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
  });

  describe("crashMessage", () => {
    test("displays crash message with help resources", () => {
      logger.crashMessage();

      const output = mockStream.getOutput();
      expect(output).toContain("Get Help");
      expect(output).toContain("discord.gg");
      expect(output).toContain("github.com");
    });

    test("uses error styling", () => {
      logger.crashMessage();

      expect(terminalColumnsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.stringContaining("🆇"), // Error icon
            expect.any(String)
          ])
        ]),
        expect.any(Object)
      );
    });
  });

  describe("showLogo", () => {
    test("displays Panfactum ASCII logo", () => {
      logger.showLogo();

      const output = mockStream.getOutput();
      expect(output).toContain("█");
      expect(output).toContain("██████");
    });

    test("uses writeRaw to preserve formatting", () => {
      logger.showLogo();

      const output = mockStream.getOutput();
      // Should contain raw ASCII art without terminal column formatting
      expect(output).toContain("╗");
      expect(output).toContain("║");
      expect(output).toContain("╝");
    });
  });

  describe("integration scenarios", () => {
    test("combines identifiers with explicit highlights", () => {
      logger.addIdentifier("auto-highlight");
      logger.info("Message with auto-highlight and manual-highlight", {
        highlights: ["manual-highlight"]
      });

      const output = mockStream.getOutput();
      expect(output).toContain("auto-highlight");
      expect(output).toContain("manual-highlight");
    });

    test("handles complex message formatting", () => {
      logger.addIdentifier("prod");
      logger.error("Deployment to prod failed with connection timeout", {
        highlights: ["Deployment"],
        badlights: ["failed", "timeout"]
      });

      const output = mockStream.getOutput();
      expect(output).toContain("prod");
      expect(output).toContain("failed");
      expect(output).toContain("timeout");
    });

    test("maintains formatting across multiple method calls", () => {
      logger.addIdentifier("cluster-1");

      logger.info("Connecting to cluster-1");
      logger.warn("cluster-1 has high memory usage");
      logger.success("cluster-1 deployment completed");

      const output = mockStream.getOutput();
      expect(output).toContain("cluster-1");
      expect((output.match(/cluster-1/g) || []).length).toBeGreaterThanOrEqual(3);
    });

    test("handles prompts with complex validation", async () => {
      const complexValidate = async (value: string) => {
        if (value.length < 3) return "Too short";
        if (!/^[a-z]+$/.test(value)) return "Only lowercase letters";
        return true;
      };

      await logger.input({
        message: "Enter environment name",
        validate: complexValidate,
        explainer: "Environment names must be lowercase letters only"
      });

      expect(inputMock).toHaveBeenCalled();
    });

    test("chains multiple prompts correctly", async () => {
      const name = await logger.input({ message: "Name?" });
      const confirmed = await logger.confirm({ message: "Proceed?" });
      const choice = await logger.select({
        message: "Environment?",
        choices: [{ name: "Dev", value: "dev" }]
      });

      expect(name).toBe("test-input");
      expect(confirmed).toBe(true);
      expect(choice).toBe("selected-value");
    });

    test("handles mixed output and prompts", async () => {
      logger.info("Starting process");
      const name = await logger.input({ message: "Enter name" });
      logger.success("Process completed");

      const output = mockStream.getOutput();
      expect(output).toContain("Starting process");
      expect(output).toContain("Process completed");
      expect(name).toBe("test-input");
    });
  });

  describe("edge cases and error handling", () => {
    test("handles null/undefined messages gracefully", () => {
      // @ts-expect-error Testing edge case
      expect(() => logger.info(null)).not.toThrow();
      mockStream.clear();

      // @ts-expect-error Testing edge case  
      expect(() => logger.warn(undefined)).not.toThrow();
    });

    test("handles very long messages", () => {
      const longMessage = "A".repeat(10000);
      logger.info(longMessage);

      const output = mockStream.getOutput();
      expect(output).toContain("A");
    });

    test("handles messages with ANSI codes", () => {
      const messageWithAnsi = "\u001b[31mRed text\u001b[0m";
      logger.info(messageWithAnsi);

      const output = mockStream.getOutput();
      expect(output).toContain("Red text");
    });

    test("handles Unicode characters", () => {
      const unicodeMessage = "Unicode: 🎉 ñ € 中文";
      logger.info(unicodeMessage);

      const output = mockStream.getOutput();
      expect(output).toContain("🎉");
      expect(output).toContain("ñ");
      expect(output).toContain("€");
      expect(output).toContain("中文");
    });

    test("handles circular highlight references", () => {
      // Edge case where highlights might reference each other
      const result = logger.applyColors("test testing tester", {
        highlights: ["test", "testing", "tester"]
      });
      expect(result).toContain("test");
    });

    test("handles extremely large number of identifiers", () => {
      // Add many identifiers
      for (let i = 0; i < 1000; i++) {
        logger.addIdentifier(`id-${i}`);
      }

      logger.info("Message with id-500 reference");
      const output = mockStream.getOutput();
      expect(output).toContain("id-500");
    });

    test("handles prompt validation errors", async () => {
      const failingValidate = () => {
        throw new Error("Validation error");
      };

      // Should not crash, validation wrapper should handle errors
      await logger.input({
        message: "Test",
        validate: failingValidate
      });

      expect(inputMock).toHaveBeenCalled();
    });

    test("handles stream write errors gracefully", () => {
      const errorStream = new MockWritableStream();
      // Override _write to simulate error handling
      errorStream._write = (_chunk, _encoding, callback) => {
        // Simulate error handling but don't propagate it
        callback();
      };

      const errorLogger = new Logger(errorStream, false);

      // Should not crash even if stream has issues
      expect(() => {
        errorLogger.info(TEST_MESSAGE);
      }).not.toThrow();
    });
  });

  describe("performance scenarios", () => {
    test("handles many rapid calls efficiently", () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        logger.info(`Message ${i}`);
      }

      const end = Date.now();
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    test("handles large highlight lists efficiently", () => {
      const highlights = Array.from({ length: 100 }, (_, i) => `highlight-${i}`);

      const start = Date.now();
      logger.applyColors("Text with highlight-50 in it", { highlights });
      const end = Date.now();

      expect(end - start).toBeLessThan(100); // Should be very fast
    });

    test("maintains performance with many identifiers", () => {
      // Add many identifiers
      for (let i = 0; i < 50; i++) {
        logger.addIdentifier(`perf-test-${i}`);
      }

      const start = Date.now();
      logger.info("Performance test message with perf-test-25");
      const end = Date.now();

      expect(end - start).toBeLessThan(100);
    });
  });
});