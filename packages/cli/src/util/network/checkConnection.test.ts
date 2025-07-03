// This file contains comprehensive unit tests for the checkConnection function
// It tests network connectivity checking including success, failure, and timeout scenarios

import net from "node:net";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { checkConnection } from "./checkConnection";

interface IMockSocket {
  end: ReturnType<typeof mock>;
  destroy: ReturnType<typeof mock>;
  on: ReturnType<typeof mock>;
  _callbacks: Record<string, Function | undefined>;
}

describe("checkConnection", () => {
  let netSpy: ReturnType<typeof spyOn<typeof net, "createConnection">>;
  let mockSocket: IMockSocket;

  beforeEach(() => {
    // Create a mock socket with event emitter functionality
    mockSocket = {
      end: mock(() => {}),
      destroy: mock(() => {}),
      on: mock((event: string, callback: Function) => {
        // Store callbacks for manual triggering in tests
        mockSocket._callbacks = mockSocket._callbacks || {};
        mockSocket._callbacks[event] = callback;
      }),
      _callbacks: {}
    };

    // Spy on net.createConnection
    netSpy = spyOn(net, "createConnection");
    netSpy.mockReturnValue(mockSocket as unknown as net.Socket);
  });

  afterEach(() => {
    mock.restore();
  });

  test("returns true when connection is successful", async () => {
    const connectionPromise = checkConnection({ 
      ip: "example.com", 
      port: 443 
    });

    // Verify createConnection was called with correct parameters
    expect(netSpy).toHaveBeenCalledWith({
      host: "example.com",
      port: 443,
      timeout: 3000
    });

    // Simulate successful connection
    mockSocket._callbacks["connect"]?.();

    const result = await connectionPromise;
    expect(result).toBe(true);
    expect(mockSocket.end).toHaveBeenCalled();
  });

  test("uses default port 80 when port is not specified", async () => {
    const connectionPromise = checkConnection({ 
      ip: "example.com" 
    });

    expect(netSpy).toHaveBeenCalledWith({
      host: "example.com",
      port: 80,
      timeout: 3000
    });

    // Simulate successful connection
    mockSocket._callbacks["connect"]?.();

    const result = await connectionPromise;
    expect(result).toBe(true);
  });

  test("returns false when connection times out", async () => {
    const connectionPromise = checkConnection({ 
      ip: "10.0.0.1", 
      port: 8080 
    });

    // Simulate timeout
    mockSocket._callbacks["timeout"]?.();

    const result = await connectionPromise;
    expect(result).toBe(false);
    expect(mockSocket.destroy).toHaveBeenCalled();
  });

  test("returns false when connection encounters an error", async () => {
    const connectionPromise = checkConnection({ 
      ip: "nonexistent.local", 
      port: 9999 
    });

    // Simulate connection error
    mockSocket._callbacks["error"]?.(new Error("ENOTFOUND"));

    const result = await connectionPromise;
    expect(result).toBe(false);
  });

  test("handles IPv4 addresses correctly", async () => {
    const connectionPromise = checkConnection({ 
      ip: "192.168.1.1", 
      port: 22 
    });

    expect(netSpy).toHaveBeenCalledWith({
      host: "192.168.1.1",
      port: 22,
      timeout: 3000
    });

    // Simulate successful connection
    mockSocket._callbacks["connect"]?.();

    const result = await connectionPromise;
    expect(result).toBe(true);
  });

  test("handles IPv6 addresses correctly", async () => {
    const connectionPromise = checkConnection({ 
      ip: "::1", 
      port: 3306 
    });

    expect(netSpy).toHaveBeenCalledWith({
      host: "::1",
      port: 3306,
      timeout: 3000
    });

    // Simulate connection error (common for IPv6 on some systems)
    mockSocket._callbacks["error"]?.(new Error("EAFNOSUPPORT"));

    const result = await connectionPromise;
    expect(result).toBe(false);
  });

  test("handles localhost connections", async () => {
    const connectionPromise = checkConnection({ 
      ip: "localhost", 
      port: 5432 
    });

    expect(netSpy).toHaveBeenCalledWith({
      host: "localhost",
      port: 5432,
      timeout: 3000
    });

    // Simulate successful connection
    mockSocket._callbacks["connect"]?.();

    const result = await connectionPromise;
    expect(result).toBe(true);
  });

  test("properly cleans up resources on successful connection", async () => {
    const connectionPromise = checkConnection({ 
      ip: "api.example.com", 
      port: 443 
    });

    // Simulate successful connection
    mockSocket._callbacks["connect"]?.();

    await connectionPromise;

    expect(mockSocket.end).toHaveBeenCalledTimes(1);
    expect(mockSocket.destroy).not.toHaveBeenCalled();
  });

  test("properly cleans up resources on timeout", async () => {
    const connectionPromise = checkConnection({ 
      ip: "10.0.0.100", 
      port: 3000 
    });

    // Simulate timeout
    mockSocket._callbacks["timeout"]?.();

    await connectionPromise;

    expect(mockSocket.destroy).toHaveBeenCalledTimes(1);
    expect(mockSocket.end).not.toHaveBeenCalled();
  });

  test("handles multiple simultaneous connections", async () => {
    // Create multiple mock sockets for parallel connections
    const mockSockets: IMockSocket[] = [];
    
    // Create each mock socket separately
    for (let i = 0; i < 3; i++) {
      const socket: IMockSocket = {
        end: mock(() => {}),
        destroy: mock(() => {}),
        on: mock(() => {}),
        _callbacks: {}
      };
      
      // Override the on method to store callbacks
      socket.on = mock((event: string, callback: Function) => {
        socket._callbacks[event] = callback;
      });
      
      mockSockets.push(socket);
    }

    let callCount = 0;
    netSpy.mockImplementation(() => {
      return mockSockets[callCount++] as unknown as net.Socket;
    });

    // Start three parallel connections
    const promises = [
      checkConnection({ ip: "server1.com", port: 80 }),
      checkConnection({ ip: "server2.com", port: 443 }),
      checkConnection({ ip: "server3.com", port: 8080 })
    ];

    // Wait a moment for all connections to be initialized
    await new Promise(resolve => globalThis.setTimeout(resolve, 10));

    // Simulate different results for each connection
    mockSockets[0]?._callbacks["connect"]?.(); // Success
    mockSockets[1]?._callbacks["error"]?.(new Error("Connection refused")); // Error
    mockSockets[2]?._callbacks["timeout"]?.(); // Timeout

    const results = await Promise.all(promises);

    expect(results).toEqual([true, false, false]);
    expect(mockSockets[0]?.end).toHaveBeenCalled();
    expect(mockSockets[1]?.end).not.toHaveBeenCalled();
    expect(mockSockets[2]?.destroy).toHaveBeenCalled();
  });

  test("handles common port numbers correctly", async () => {
    const testCases = [
      { port: 22, description: "SSH" },
      { port: 80, description: "HTTP" },
      { port: 443, description: "HTTPS" },
      { port: 3306, description: "MySQL" },
      { port: 5432, description: "PostgreSQL" },
      { port: 6379, description: "Redis" },
      { port: 27017, description: "MongoDB" }
    ];

    for (const { port } of testCases) {
      netSpy.mockClear();
      mockSocket.end.mockClear();

      const connectionPromise = checkConnection({ 
        ip: "test.example.com", 
        port 
      });

      expect(netSpy).toHaveBeenCalledWith({
        host: "test.example.com",
        port,
        timeout: 3000
      });

      // Simulate successful connection
      mockSocket._callbacks["connect"]?.();

      const result = await connectionPromise;
      expect(result).toBe(true);
    }
  });

  test("handles edge case with port 0", async () => {
    const connectionPromise = checkConnection({ 
      ip: "example.com", 
      port: 0 
    });

    expect(netSpy).toHaveBeenCalledWith({
      host: "example.com",
      port: 0,
      timeout: 3000
    });

    // Port 0 typically means any available port, simulate error
    mockSocket._callbacks["error"]?.(new Error("Invalid port"));

    const result = await connectionPromise;
    expect(result).toBe(false);
  });

  test("handles maximum valid port number", async () => {
    const connectionPromise = checkConnection({ 
      ip: "example.com", 
      port: 65535 
    });

    expect(netSpy).toHaveBeenCalledWith({
      host: "example.com",
      port: 65535,
      timeout: 3000
    });

    // Simulate connection error (unlikely port to be open)
    mockSocket._callbacks["error"]?.(new Error("Connection refused"));

    const result = await connectionPromise;
    expect(result).toBe(false);
  });
});