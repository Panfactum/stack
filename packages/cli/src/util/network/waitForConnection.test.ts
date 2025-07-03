// This file contains comprehensive unit tests for the waitForConnection function
// It tests waiting for network connections with retry logic, timeouts, and error handling

import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { CLIError } from "@/util/error/error";
import * as sleepModule from "@/util/util/sleep";
import * as checkConnectionModule from "./checkConnection";
import { waitForConnection } from "./waitForConnection";

describe("waitForConnection", () => {
  let checkConnectionSpy: ReturnType<typeof spyOn<typeof checkConnectionModule, "checkConnection">>;
  let sleepSpy: ReturnType<typeof spyOn<typeof sleepModule, "sleep">>;

  beforeEach(() => {
    // Spy on checkConnection to control its behavior
    checkConnectionSpy = spyOn(checkConnectionModule, "checkConnection");
    
    // Spy on sleep to avoid actual delays in tests
    sleepSpy = spyOn(sleepModule, "sleep");
    sleepSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mock.restore();
  });

  test("resolves immediately when connection is available on first attempt", async () => {
    checkConnectionSpy.mockResolvedValue(true);

    await waitForConnection({
      ip: "example.com",
      port: 443
    });

    expect(checkConnectionSpy).toHaveBeenCalledTimes(1);
    expect(checkConnectionSpy).toHaveBeenCalledWith({
      ip: "example.com",
      port: 443
    });
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test("uses default port 80 when port is not specified", async () => {
    checkConnectionSpy.mockResolvedValue(true);

    await waitForConnection({
      ip: "example.com"
    });

    expect(checkConnectionSpy).toHaveBeenCalledWith({
      ip: "example.com",
      port: 80
    });
  });

  test("retries connection attempts when initially failing", async () => {
    // Fail first two attempts, succeed on third
    checkConnectionSpy
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await waitForConnection({
      ip: "slow-service.com",
      port: 8080,
      retryDelay: 500
    });

    expect(checkConnectionSpy).toHaveBeenCalledTimes(3);
    expect(sleepSpy).toHaveBeenCalledTimes(2); // Sleep between attempts, not after success
    expect(sleepSpy).toHaveBeenCalledWith(500);
  });

  test("respects custom maxAttempts setting", async () => {
    checkConnectionSpy.mockResolvedValue(false);

    await expect(
      waitForConnection({
        ip: "unreachable.com",
        port: 9999,
        maxAttempts: 5
      })
    ).rejects.toThrow(CLIError);

    expect(checkConnectionSpy).toHaveBeenCalledTimes(5);
    expect(sleepSpy).toHaveBeenCalledTimes(4); // No sleep after last attempt
  });

  test("respects custom retryDelay setting", async () => {
    checkConnectionSpy
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await waitForConnection({
      ip: "example.com",
      port: 3000,
      retryDelay: 2000
    });

    expect(sleepSpy).toHaveBeenCalledWith(2000);
  });

  test("throws CLIError when max attempts are reached", async () => {
    checkConnectionSpy.mockResolvedValue(false);

    await expect(
      waitForConnection({
        ip: "down-service.com",
        port: 5432,
        maxAttempts: 3
      })
    ).rejects.toThrow(
      new CLIError("Connection to down-service.com:5432 did not become available after 3 attempts")
    );

    expect(checkConnectionSpy).toHaveBeenCalledTimes(3);
  });

  test("uses default values correctly", async () => {
    checkConnectionSpy.mockResolvedValue(false);

    await expect(
      waitForConnection({
        ip: "test.com"
      })
    ).rejects.toThrow();

    // Should use defaults: port 80, maxAttempts 30, retryDelay 1000
    expect(checkConnectionSpy).toHaveBeenCalledTimes(30);
    expect(sleepSpy).toHaveBeenCalledTimes(29);
    expect(sleepSpy).toHaveBeenCalledWith(1000);
  });

  test("handles localhost connections", async () => {
    checkConnectionSpy.mockResolvedValue(true);

    await waitForConnection({
      ip: "localhost",
      port: 5432
    });

    expect(checkConnectionSpy).toHaveBeenCalledWith({
      ip: "localhost",
      port: 5432
    });
  });

  test("handles IPv4 addresses", async () => {
    checkConnectionSpy.mockResolvedValue(true);

    await waitForConnection({
      ip: "192.168.1.100",
      port: 22
    });

    expect(checkConnectionSpy).toHaveBeenCalledWith({
      ip: "192.168.1.100",
      port: 22
    });
  });

  test("handles IPv6 addresses", async () => {
    checkConnectionSpy.mockResolvedValue(true);

    await waitForConnection({
      ip: "::1",
      port: 80
    });

    expect(checkConnectionSpy).toHaveBeenCalledWith({
      ip: "::1",
      port: 80
    });
  });

  test("succeeds on last possible attempt", async () => {
    const maxAttempts = 5;
    
    // Fail all attempts except the last one
    for (let i = 0; i < maxAttempts - 1; i++) {
      checkConnectionSpy.mockResolvedValueOnce(false);
    }
    checkConnectionSpy.mockResolvedValueOnce(true);

    await waitForConnection({
      ip: "eventually-up.com",
      port: 8080,
      maxAttempts
    });

    expect(checkConnectionSpy).toHaveBeenCalledTimes(maxAttempts);
    expect(sleepSpy).toHaveBeenCalledTimes(maxAttempts - 1);
  });

  test("handles checkConnection throwing errors", async () => {
    checkConnectionSpy.mockRejectedValue(new Error("Network error"));

    await expect(
      waitForConnection({
        ip: "error-prone.com",
        port: 443
      })
    ).rejects.toThrow("Network error");
  });

  test("handles zero maxAttempts", async () => {
    await expect(
      waitForConnection({
        ip: "test.com",
        port: 80,
        maxAttempts: 0
      })
    ).rejects.toThrow(CLIError);

    expect(checkConnectionSpy).not.toHaveBeenCalled();
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test("handles single attempt (maxAttempts = 1)", async () => {
    checkConnectionSpy.mockResolvedValue(false);

    await expect(
      waitForConnection({
        ip: "test.com",
        port: 80,
        maxAttempts: 1
      })
    ).rejects.toThrow(CLIError);

    expect(checkConnectionSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled(); // No sleep with only one attempt
  });

  test("handles very short retry delay", async () => {
    checkConnectionSpy
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await waitForConnection({
      ip: "fast-retry.com",
      port: 3000,
      retryDelay: 1 // 1ms delay
    });

    expect(sleepSpy).toHaveBeenCalledWith(1);
  });

  test("handles common database ports", async () => {
    const testCases = [
      { port: 3306, name: "MySQL" },
      { port: 5432, name: "PostgreSQL" },
      { port: 6379, name: "Redis" },
      { port: 27017, name: "MongoDB" }
    ];

    for (const { port } of testCases) {
      checkConnectionSpy.mockClear();
      checkConnectionSpy.mockResolvedValue(true);

      await waitForConnection({
        ip: "db.example.com",
        port
      });

      expect(checkConnectionSpy).toHaveBeenCalledWith({
        ip: "db.example.com",
        port
      });
    }
  });

  test("includes correct error message with all parameters", async () => {
    checkConnectionSpy.mockResolvedValue(false);

    await expect(
      waitForConnection({
        ip: "custom-host.internal",
        port: 9876,
        maxAttempts: 7
      })
    ).rejects.toThrow(
      new CLIError("Connection to custom-host.internal:9876 did not become available after 7 attempts")
    );
  });

  test("works with immediate success after multiple setup calls", async () => {
    // Simulate a scenario where multiple calls are made in sequence
    checkConnectionSpy.mockResolvedValue(true);

    await waitForConnection({ ip: "service1.com", port: 80 });
    await waitForConnection({ ip: "service2.com", port: 443 });
    await waitForConnection({ ip: "service3.com", port: 8080 });

    expect(checkConnectionSpy).toHaveBeenCalledTimes(3);
    expect(sleepSpy).not.toHaveBeenCalled();
  });
});