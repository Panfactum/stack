// Unit tests for the isRegistered domain utility
// Tests domain registration detection using dig and whois commands

import { describe, expect, test, mock, beforeEach, afterEach, spyOn } from "bun:test";
import * as executeModule from "@/util/subprocess/execute";
import { isRegistered } from "./isRegistered";
import type { PanfactumContext } from "@/util/context/context";

// Test constants
const TEST_DOMAIN = "example.com";

// Helper to create a mock context
const createMockContext = (): PanfactumContext => ({
    logger: {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {})
    }
} as unknown as PanfactumContext);

describe("isRegistered", () => {
    let executeMock: ReturnType<typeof spyOn<typeof executeModule, "execute">>;

    beforeEach(() => {
        // Create spies for module functions
        executeMock = spyOn(executeModule, "execute");
    });

    afterEach(() => {
        // Restore the mocked module functions
        mock.restore();
    });
    test("returns true when domain has nameservers", async () => {
        // Mock dig command to return nameservers
        executeMock.mockResolvedValueOnce({
            stdout: "ns1.test-ns.com.\nns2.test-ns.com.\n",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(true);
        expect(executeMock).toHaveBeenCalledWith({
            command: ["dig", "+short", "NS", TEST_DOMAIN, "@1.1.1.1"],
            context,
            workingDirectory: process.cwd(),
            errorMessage: "Failed to execute dig command"
        });
    });

    test("returns true when whois finds domain registration", async () => {
        // Mock dig command to return empty (no nameservers)
        executeMock.mockResolvedValueOnce({
            stdout: "",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        // Mock whois command to find domain registration
        executeMock.mockResolvedValueOnce({
            stdout: `Domain Name: ${TEST_DOMAIN}\nRegistrar: Test Registrar\n`,
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(true);
        expect(executeMock).toHaveBeenCalledTimes(2);
        expect(executeMock).toHaveBeenNthCalledWith(2, {
            command: ["whois", TEST_DOMAIN],
            context,
            workingDirectory: process.cwd(),
            errorMessage: "Failed to execute whois command"
        });
    });

    test("returns false when neither dig nor whois find domain", async () => {
        // Mock dig command to return empty (no nameservers)
        executeMock.mockResolvedValueOnce({
            stdout: "",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        // Mock whois command to not find domain registration
        executeMock.mockResolvedValueOnce({
            stdout: `No match for ${TEST_DOMAIN}\nRegistrar WHOIS Server:\n`,
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("returns true when dig fails but whois finds domain", async () => {
        // Mock dig command to throw error
        executeMock.mockRejectedValueOnce(new Error("Dig command failed"));

        // Mock whois command to find domain registration
        executeMock.mockResolvedValueOnce({
            stdout: `Domain Name: ${TEST_DOMAIN}\nRegistrar: Test Registrar\n`,
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(true);
    });

    test("returns false when both dig and whois fail", async () => {
        // Mock dig command to throw error
        executeMock.mockRejectedValueOnce(new Error("Dig command failed"));

        // Mock whois command to throw error
        executeMock.mockRejectedValueOnce(new Error("Whois command failed"));

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("handles domain with whitespace in nameserver output", async () => {
        // Mock dig command to return nameservers with whitespace
        executeMock.mockResolvedValueOnce({
            stdout: "  ns1.test-ns.com.  \n  ns2.test-ns.com.  \n  ",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(true);
    });

    test("returns false when dig returns empty string after trim", async () => {
        // Mock dig command to return only whitespace
        executeMock.mockResolvedValueOnce({
            stdout: "   \n   \n   ",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        // Mock whois command to not find domain
        executeMock.mockResolvedValueOnce({
            stdout: `No match for ${TEST_DOMAIN}`,
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("handles whois output with exact domain name match", async () => {
        // Mock dig command to return empty
        executeMock.mockResolvedValueOnce({
            stdout: "",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        // Mock whois command with exact domain name match
        executeMock.mockResolvedValueOnce({
            stdout: "Registry Domain ID: 123456\nDomain Name: test-domain.com\nRegistrar: Example Corp\n",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        const context = createMockContext();
        const result = await isRegistered({
            domain: "test-domain.com",
            context
        });

        expect(result).toBe(true);
    });

    test("returns false when whois output contains similar but different domain", async () => {
        // Mock dig command to return empty
        executeMock.mockResolvedValueOnce({
            stdout: "",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        // Mock whois command with similar but different domain
        executeMock.mockResolvedValueOnce({
            stdout: "Domain Name: different-example.com\nRegistrar: Example Corp\n",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        const context = createMockContext();
        const result = await isRegistered({
            domain: TEST_DOMAIN,
            context
        });

        expect(result).toBe(false);
    });

    test("handles subdomain registration check", async () => {
        // Mock dig command to return nameservers for subdomain
        executeMock.mockResolvedValueOnce({
            stdout: "ns1.subdomain.test.com.\n",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

        const context = createMockContext();
        const result = await isRegistered({
            domain: "api.subdomain.test.com",
            context
        });

        expect(result).toBe(true);
        expect(executeMock).toHaveBeenCalledWith({
            command: ["dig", "+short", "NS", "api.subdomain.test.com", "@1.1.1.1"],
            context,
            workingDirectory: process.cwd(),
            errorMessage: "Failed to execute dig command"
        });
    });

    test("uses Cloudflare DNS resolver in dig command", async () => {
        // Mock dig command
        executeMock.mockResolvedValueOnce({
            stdout: "ns1.test-ns.com.\n",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

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
        executeMock.mockResolvedValueOnce({
            stdout: "",
            stderr: "",
            exitCode: 0,
            pid: 12345
        });
        executeMock.mockResolvedValueOnce({
            stdout: `Domain Name: ${TEST_DOMAIN}\n`,
            stderr: "",
            exitCode: 0,
            pid: 12345
        });

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