// Tests for PanfactumCommand base classes and AlreadyLoggedError sentinel
// Verifies that CLI errors produce exit code 1 and are properly logged

import { Writable } from "node:stream";
import { describe, test, expect, afterEach, mock } from "bun:test";
import { Cli } from "clipanion";
import { AlreadyLoggedError, PanfactumLightCommand, PanfactumCommand } from "./panfactumCommand";
import type { PanfactumBaseContext, PanfactumContext } from "@/util/context/context";

/**
 * Writable stream that discards all output.
 * Used to absorb Clipanion's error formatting output during tests.
 *
 * @internal
 */
class DevNull extends Writable {
    override _write(_chunk: unknown, _encoding: string, callback: () => void) {
        callback();
    }
}

/**
 * Creates a minimal mock logger with all methods needed by handleCommandError.
 *
 * @internal
 */
function createMockLogger() {
    return {
        error: mock((_msg: string) => {}),
        writeRaw: mock((_msg: string) => {}),
        crashMessage: mock(() => {}),
        info: mock((_msg: string) => {}),
        warn: mock((_msg: string) => {}),
        debug: mock((_msg: string) => {}),
    };
}

/**
 * Creates a minimal context sufficient for PanfactumLightCommand tests.
 *
 * @internal
 */
function createLightContext(): PanfactumBaseContext & { logger: ReturnType<typeof createMockLogger> } {
    const logger = createMockLogger();
    return {
        stdin: process.stdin,
        stdout: new DevNull(),
        stderr: new DevNull(),
        colorDepth: 1,
        logger,
        subprocessManager: {} as PanfactumBaseContext["subprocessManager"],
        shutdownHooks: new Set(),
        registerShutdownHook: mock(() => () => {}),
    } as unknown as PanfactumBaseContext & { logger: ReturnType<typeof createMockLogger> };
}

/**
 * Creates a minimal context sufficient for PanfactumCommand (full) tests.
 *
 * @internal
 */
function createFullContext(): PanfactumContext & { logger: ReturnType<typeof createMockLogger> } {
    return {
        ...createLightContext(),
        devshellConfig: {} as PanfactumContext["devshellConfig"],
    } as unknown as PanfactumContext & { logger: ReturnType<typeof createMockLogger> };
}

describe("AlreadyLoggedError", () => {
    test("is an instance of Error", () => {
        const err = new AlreadyLoggedError();
        expect(err instanceof Error).toBe(true);
    });

    test("has name AlreadyLoggedError", () => {
        const err = new AlreadyLoggedError();
        expect(err.name).toBe("AlreadyLoggedError");
    });

    test("has empty message", () => {
        const err = new AlreadyLoggedError();
        expect(err.message).toBe("");
    });
});

describe("PanfactumLightCommand", () => {
    afterEach(() => {
        mock.restore();
    });

    describe("catch() — exit code behavior", () => {
        test("returns exit code 1 when execute() throws", async () => {
            class FailingCommand extends PanfactumLightCommand {
                static override paths = [["light-fail"]];
                async execute() {
                    throw new Error("something went wrong");
                }
            }

            const cli = new Cli<PanfactumBaseContext>({ binaryName: "pf-test" });
            cli.register(FailingCommand);

            const exitCode = await cli.run(["light-fail"], createLightContext());

            expect(exitCode).toBe(1);
        });

        test("returns exit code 0 when execute() succeeds", async () => {
            class SuccessCommand extends PanfactumLightCommand {
                static override paths = [["light-success"]];
                async execute() {
                    // no-op
                }
            }

            const cli = new Cli<PanfactumBaseContext>({ binaryName: "pf-test" });
            cli.register(SuccessCommand);

            const exitCode = await cli.run(["light-success"], createLightContext());

            expect(exitCode).toBe(0);
        });
    });

    describe("catch() — error logging", () => {
        test("logs the error message via logger.error()", async () => {
            class FailingCommand extends PanfactumLightCommand {
                static override paths = [["light-log-error"]];
                async execute() {
                    throw new Error("my error message");
                }
            }

            const cli = new Cli<PanfactumBaseContext>({ binaryName: "pf-test" });
            cli.register(FailingCommand);

            const ctx = createLightContext();
            await cli.run(["light-log-error"], ctx);

            expect(ctx.logger.error).toHaveBeenCalledWith("my error message");
        });

        test("calls logger.crashMessage() on any error", async () => {
            class FailingCommand extends PanfactumLightCommand {
                static override paths = [["light-crash-msg"]];
                async execute() {
                    throw new Error("trigger crash message");
                }
            }

            const cli = new Cli<PanfactumBaseContext>({ binaryName: "pf-test" });
            cli.register(FailingCommand);

            const ctx = createLightContext();
            await cli.run(["light-crash-msg"], ctx);

            expect(ctx.logger.crashMessage).toHaveBeenCalled();
        });

        test("logs stack trace via logger.writeRaw()", async () => {
            class FailingCommand extends PanfactumLightCommand {
                static override paths = [["light-stack"]];
                async execute() {
                    throw new Error("stack trace error");
                }
            }

            const cli = new Cli<PanfactumBaseContext>({ binaryName: "pf-test" });
            cli.register(FailingCommand);

            const ctx = createLightContext();
            await cli.run(["light-stack"], ctx);

            // writeRaw is called with the red-colored stack trace
            expect(ctx.logger.writeRaw).toHaveBeenCalled();
        });
    });
});

describe("PanfactumCommand", () => {
    afterEach(() => {
        mock.restore();
    });

    describe("catch() — exit code behavior", () => {
        test("returns exit code 1 when execute() throws", async () => {
            class FailingCommand extends PanfactumCommand {
                static override paths = [["full-fail"]];
                async execute() {
                    throw new Error("full command error");
                }
            }

            const cli = new Cli<PanfactumContext>({ binaryName: "pf-test" });
            cli.register(FailingCommand);

            const exitCode = await cli.run(["full-fail"], createFullContext());

            expect(exitCode).toBe(1);
        });

        test("returns exit code 0 when execute() succeeds", async () => {
            class SuccessCommand extends PanfactumCommand {
                static override paths = [["full-success"]];
                async execute() {
                    // no-op
                }
            }

            const cli = new Cli<PanfactumContext>({ binaryName: "pf-test" });
            cli.register(SuccessCommand);

            const exitCode = await cli.run(["full-success"], createFullContext());

            expect(exitCode).toBe(0);
        });
    });

    describe("catch() — error logging", () => {
        test("logs the error message via logger.error()", async () => {
            class FailingCommand extends PanfactumCommand {
                static override paths = [["full-log-error"]];
                async execute() {
                    throw new Error("full error message");
                }
            }

            const cli = new Cli<PanfactumContext>({ binaryName: "pf-test" });
            cli.register(FailingCommand);

            const ctx = createFullContext();
            await cli.run(["full-log-error"], ctx);

            expect(ctx.logger.error).toHaveBeenCalledWith("full error message");
        });

        test("calls logger.crashMessage() on any error", async () => {
            class FailingCommand extends PanfactumCommand {
                static override paths = [["full-crash-msg"]];
                async execute() {
                    throw new Error("trigger full crash message");
                }
            }

            const cli = new Cli<PanfactumContext>({ binaryName: "pf-test" });
            cli.register(FailingCommand);

            const ctx = createFullContext();
            await cli.run(["full-crash-msg"], ctx);

            expect(ctx.logger.crashMessage).toHaveBeenCalled();
        });
    });
});
