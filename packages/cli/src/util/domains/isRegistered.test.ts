// Unit tests for the isRegistered domain utility
// Tests domain registration detection using dig and whois commands

import { describe, expect, test, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { SubprocessManager } from "@/util/subprocess/SubprocessManager";
import { isRegistered } from "./isRegistered";
import type { PanfactumContext } from "@/util/context/context";
import type { IExecuteHandle, IExecuteOutput } from "@/util/subprocess/SubprocessManager";

// Test constants
const TEST_DOMAIN = "example.com";

/**
 * Creates a minimal {@link IExecuteHandle} whose `exited` promise resolves
 * with an {@link IExecuteOutput} built from the provided overrides. Fills in
 * sensible defaults for fields that callers rarely care about.
 *
 * @internal
 */
const createMockHandle = (
    overrides: Partial<IExecuteOutput> = {},
): IExecuteHandle => {
    const result: IExecuteOutput = {
        stdout: "",
        stderr: "",
        output: "",
        exitCode: 0,
        pid: 0,
        signalCode: null,
        aborted: false,
        ...overrides,
    };
    return {
        pid: result.pid,
        exited: Promise.resolve(result),
        abortController: undefined,
    };
};

/**
 * Creates a minimal {@link IExecuteHandle} whose `exited` promise rejects
 * with the provided error — used to simulate spawn failures.
 *
 * @internal
 */
const createRejectedHandle = (error: Error): IExecuteHandle => {
    const exited = Promise.reject(error);
    // Suppress unhandled rejection warnings for promises that may never
    // be observed by the production code path under test.
    exited.catch(() => {});
    return {
        pid: 0,
        exited,
        abortController: undefined,
    };
};

// Helper to create a mock context
const createMockContext = (): PanfactumContext => {
    const ctx = {
        logger: {
            debug: mock(() => {}),
            info: mock(() => {}),
            warn: mock(() => {}),
            error: mock(() => {})
        }
    } as unknown as PanfactumContext;
    ctx.subprocessManager = new SubprocessManager(ctx);
    return ctx;
};

describe("isRegistered", () => {
    let executeMock: ReturnType<typeof spyOn<SubprocessManager, "execute">>;

    beforeEach(() => {
        // Spy on the execute method on the SubprocessManager prototype
        executeMock = spyOn(SubprocessManager.prototype, "execute");
    });

    afterEach(() => {
        // Restore the mocked module functions
        mock.restore();
    });
    test("returns true when domain has nameservers", async () => {
        // Mock dig command to return nameservers
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "ns1.test-ns.com.\nns2.test-ns.com.\n",
            stderr: "",
            output: "ns1.test-ns.com.\nns2.test-ns.com.\n",
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(true);
        expect(executeMock).toHaveBeenCalledWith({
            command: ["dig", "+short", "NS", TEST_DOMAIN, "@1.1.1.1"],
            workingDirectory: process.cwd(),
        });
    });

    test("returns true when whois finds domain registration", async () => {
        // Mock dig command to return empty (no nameservers)
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "",
            stderr: "",
            output: "",
            exitCode: 0,
            pid: 12345
        }));

        // Mock whois command to find domain registration
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: `Domain Name: ${TEST_DOMAIN}\nRegistrar: Test Registrar\n`,
            stderr: "",
            output: `Domain Name: ${TEST_DOMAIN}\nRegistrar: Test Registrar\n`,
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(true);
        expect(executeMock).toHaveBeenCalledTimes(2);
        expect(executeMock).toHaveBeenNthCalledWith(2, {
            command: ["whois", TEST_DOMAIN],
            workingDirectory: process.cwd(),
        });
    });

    test("returns false when neither dig nor whois find domain", async () => {
        // Mock dig command to return empty (no nameservers)
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "",
            stderr: "",
            output: "",
            exitCode: 0,
            pid: 12345
        }));

        // Mock whois command to not find domain registration
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: `No match for ${TEST_DOMAIN}\nRegistrar WHOIS Server:\n`,
            stderr: "",
            output: `No match for ${TEST_DOMAIN}\nRegistrar WHOIS Server:\n`,
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("returns true when dig fails but whois finds domain", async () => {
        // Mock dig command to reject (spawn failure)
        executeMock.mockReturnValueOnce(createRejectedHandle(new Error("Dig command failed")));

        // Mock whois command to find domain registration
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: `Domain Name: ${TEST_DOMAIN}\nRegistrar: Test Registrar\n`,
            stderr: "",
            output: `Domain Name: ${TEST_DOMAIN}\nRegistrar: Test Registrar\n`,
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(true);
    });

    test("returns false when both dig and whois fail", async () => {
        // Mock dig command to reject (spawn failure)
        executeMock.mockReturnValueOnce(createRejectedHandle(new Error("Dig command failed")));

        // Mock whois command to reject (spawn failure)
        executeMock.mockReturnValueOnce(createRejectedHandle(new Error("Whois command failed")));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("returns false when dig returns non-zero exit code", async () => {
        // Mock dig command to return non-zero exit code
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "",
            stderr: "dig failed",
            output: "dig failed",
            exitCode: 1,
            pid: 12345
        }));

        // Mock whois command to not find domain
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: `No match for ${TEST_DOMAIN}`,
            stderr: "",
            output: `No match for ${TEST_DOMAIN}`,
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("returns false when whois returns non-zero exit code", async () => {
        // Mock dig command to return empty
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "",
            stderr: "",
            output: "",
            exitCode: 0,
            pid: 12345
        }));

        // Mock whois command to return non-zero exit code
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "",
            stderr: "whois failed",
            output: "whois failed",
            exitCode: 1,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("handles domain with whitespace in nameserver output", async () => {
        // Mock dig command to return nameservers with whitespace
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "  ns1.test-ns.com.  \n  ns2.test-ns.com.  \n  ",
            stderr: "",
            output: "  ns1.test-ns.com.  \n  ns2.test-ns.com.  \n  ",
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(true);
    });

    test("returns false when dig returns empty string after trim", async () => {
        // Mock dig command to return only whitespace
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "   \n   \n   ",
            stderr: "",
            output: "   \n   \n   ",
            exitCode: 0,
            pid: 12345
        }));

        // Mock whois command to not find domain
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: `No match for ${TEST_DOMAIN}`,
            stderr: "",
            output: `No match for ${TEST_DOMAIN}`,
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("handles whois output with exact domain name match", async () => {
        // Mock dig command to return empty
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "",
            stderr: "",
            output: "",
            exitCode: 0,
            pid: 12345
        }));

        // Mock whois command with exact domain name match
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "Registry Domain ID: 123456\nDomain Name: test-domain.com\nRegistrar: Example Corp\n",
            stderr: "",
            output: "Registry Domain ID: 123456\nDomain Name: test-domain.com\nRegistrar: Example Corp\n",
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: "test-domain.com",
            context
        });

        expect(result).toBe(true);
    });

    test("returns false when whois output contains similar but different domain", async () => {
        // Mock dig command to return empty
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "",
            stderr: "",
            output: "",
            exitCode: 0,
            pid: 12345
        }));

        // Mock whois command with similar but different domain
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "Domain Name: different-example.com\nRegistrar: Example Corp\n",
            stderr: "",
            output: "Domain Name: different-example.com\nRegistrar: Example Corp\n",
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("handles subdomain registration check", async () => {
        // Mock dig command to return nameservers for subdomain
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "ns1.subdomain.test.com.\n",
            stderr: "",
            output: "ns1.subdomain.test.com.\n",
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        const result = await isRegistered({
            domain: "api.subdomain.test.com",
            context
        });

        expect(result).toBe(true);
        expect(executeMock).toHaveBeenCalledWith({
            command: ["dig", "+short", "NS", "api.subdomain.test.com", "@1.1.1.1"],
            workingDirectory: process.cwd(),
        });
    });

    test("uses Cloudflare DNS resolver in dig command", async () => {
        // Mock dig command
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "ns1.test-ns.com.\n",
            stderr: "",
            output: "ns1.test-ns.com.\n",
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        // Verify that the dig command uses Cloudflare DNS (1.1.1.1)
        expect(executeMock).toHaveBeenCalledWith(
            expect.objectContaining({
                command: expect.arrayContaining(["@1.1.1.1"])
            })
        );
    });

    test("passes correct working directory to execute calls", async () => {
        // Mock both commands
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: "",
            stderr: "",
            output: "",
            exitCode: 0,
            pid: 12345
        }));
        executeMock.mockReturnValueOnce(createMockHandle({
            stdout: `Domain Name: ${TEST_DOMAIN}\n`,
            stderr: "",
            output: `Domain Name: ${TEST_DOMAIN}\n`,
            exitCode: 0,
            pid: 12345
        }));

        const context = createMockContext();
        await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        // Verify both calls use process.cwd() as working directory
        expect(executeMock).toHaveBeenNthCalledWith(1,
            expect.objectContaining({
                workingDirectory: process.cwd()
            })
        );
        expect(executeMock).toHaveBeenNthCalledWith(2,
            expect.objectContaining({
                workingDirectory: process.cwd()
            })
        );
    });
});
