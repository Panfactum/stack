// Tests for isPortAvailable utility
// Tests network port availability checking functionality

import { createServer } from "net";
import { describe, expect, test } from "bun:test";
import { isPortAvailable } from "./isPortAvailable";

describe("isPortAvailable", () => {
  test("returns true for an available port", async () => {
    // Use a random high port to minimize conflicts
    const port = 50000 + Math.floor(Math.random() * 10000);
    
    const available = await isPortAvailable(port);
    expect(available).toBe(true);
  });

  test("returns false for a port that is in use", async () => {
    // Create a server to occupy a port
    const port = 50000 + Math.floor(Math.random() * 10000);
    const server = createServer();
    
    await new Promise<void>((resolve) => {
      server.listen(port, () => resolve());
    });

    try {
      const available = await isPortAvailable(port);
      expect(available).toBe(false);
    } finally {
      // Clean up
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  test("handles multiple concurrent checks", async () => {
    // Test that multiple checks don't interfere with each other
    const basePort = 51000 + Math.floor(Math.random() * 5000);
    const ports = [basePort, basePort + 1, basePort + 2, basePort + 3, basePort + 4];
    
    const results = await Promise.all(
      ports.map(port => isPortAvailable(port))
    );
    
    // All should be available
    expect(results).toEqual([true, true, true, true, true]);
  });

  test("properly cleans up after checking", async () => {
    // Verify that checking a port doesn't leave it occupied
    const port = 52000 + Math.floor(Math.random() * 5000);
    
    // First check
    const firstCheck = await isPortAvailable(port);
    
    // Second check should return the same result
    const secondCheck = await isPortAvailable(port);
    expect(secondCheck).toBe(firstCheck);
    
    // If the port was available, we should be able to actually bind to it
    if (firstCheck) {
      const server = createServer();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => resolve());
      });
      
      // Clean up
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  test("handles system ports correctly", async () => {
    // Port 80 typically requires elevated privileges
    // This test might return either true or false depending on permissions
    // but it should not throw an error
    const result = await isPortAvailable(80);
    expect(typeof result).toBe("boolean");
  });

  test("throws error for invalid port numbers", async () => {
    // Test various invalid port numbers
    const invalidPorts = [
      { port: -1, description: "negative port" },
      { port: 65536, description: "above max port" },
      { port: 100000, description: "way above max port" },
      { port: 3.14, description: "non-integer port" },
      { port: NaN, description: "NaN port" },
      { port: Infinity, description: "Infinity port" },
    ];
    
    for (const { port } of invalidPorts) {
      // The validation throws synchronously, not in a promise
      expect(() => isPortAvailable(port)).toThrow(
        `Invalid port number: ${port}. Must be an integer between 0 and 65535.`
      );
    }
  });

  test("accepts port 0 for OS-assigned port", async () => {
    // Port 0 is special - it tells the OS to assign any available port
    const result = await isPortAvailable(0);
    expect(typeof result).toBe("boolean");
  });

  test("works with common development ports", async () => {
    // Test some common ports (they might be in use, but function should work)
    const commonPorts = [3000, 8080, 8000, 5000];
    
    const results = await Promise.all(
      commonPorts.map(async (port) => {
        const result = await isPortAvailable(port);
        return typeof result === "boolean";
      })
    );
    
    // All should return boolean values
    expect(results).toEqual([true, true, true, true]);
  });

  test("handles rapid sequential checks on same port", async () => {
    const port = 53000 + Math.floor(Math.random() * 5000);
    
    // Rapid fire checks
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(await isPortAvailable(port));
    }
    
    // All should return the same result (true)
    expect(results).toEqual(Array(10).fill(true));
  });

  test("respects custom timeout option", async () => {
    // Create a server that deliberately delays accepting connections
    const port = 54000 + Math.floor(Math.random() * 5000);
    
    // Test with a very short timeout
    const start = Date.now();
    const result = await isPortAvailable(port, { timeout: 100 });
    const elapsed = Date.now() - start;
    
    // Should complete within reasonable time of the timeout
    expect(elapsed).toBeLessThan(200);
    expect(result).toBe(true); // Port should be available
  });

  test("allows checking specific host interfaces", async () => {
    const port = 55000 + Math.floor(Math.random() * 5000);
    
    // Test localhost specifically
    const localhostResult = await isPortAvailable(port, { host: '127.0.0.1' });
    expect(localhostResult).toBe(true);
    
    // Test all interfaces (default)
    const allInterfacesResult = await isPortAvailable(port, { host: '0.0.0.0' });
    expect(allInterfacesResult).toBe(true);
  });

  test("handles timeout and cleanup properly", async () => {
    // Use a port that's likely available
    const port = 56000 + Math.floor(Math.random() * 5000);
    
    // Run multiple checks with timeout to ensure cleanup works
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(isPortAvailable(port + i * 10, { timeout: 500 }));
    }
    
    const results = await Promise.all(promises);
    // All results should be boolean values (some might be false if ports are in use)
    expect(results.every(r => typeof r === 'boolean')).toBe(true);
    // At least some should be available
    expect(results.filter(r => r === true).length).toBeGreaterThan(0);
  });
});