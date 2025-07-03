// Tests for getOpenPorts utility
// Tests finding multiple available network ports

import { describe, expect, test } from "bun:test";
import { CLIError } from "@/util/error/error";
import { getOpenPorts } from "./getOpenPorts";

describe("getOpenPorts", () => {
  test("finds requested number of ports in default range", async () => {
    const count = 3;
    const ports = await getOpenPorts({ count });
    
    expect(ports).toHaveLength(count);
    expect(ports.every(port => typeof port === "number")).toBe(true);
    expect(ports.every(port => port >= 30000 && port <= 32767)).toBe(true);
    
    // Ensure no duplicates
    const uniquePorts = new Set(ports);
    expect(uniquePorts.size).toBe(count);
  });

  test("finds ports in custom range", async () => {
    const count = 2;
    const startPort = 40000;
    const endPort = 40100;
    
    const ports = await getOpenPorts({ count, startPort, endPort });
    
    expect(ports).toHaveLength(count);
    expect(ports.every(port => port >= startPort && port <= endPort)).toBe(true);
  });

  test("returns sequential available ports", async () => {
    const count = 5;
    const ports = await getOpenPorts({ count });
    
    // Ports should be in ascending order (not necessarily consecutive)
    for (let i = 1; i < ports.length; i++) {
      expect(ports[i]).toBeGreaterThan(ports[i - 1]!);
    }
  });

  test("throws error when not enough ports available", async () => {
    // Use a very small range that likely won't have enough ports
    const count = 10;
    const startPort = 65530;
    const endPort = 65535;
    
    await expect(
      getOpenPorts({ count, startPort, endPort })
    ).rejects.toThrow(CLIError);
  });

  test("handles single port request", async () => {
    const ports = await getOpenPorts({ count: 1 });
    
    expect(ports).toHaveLength(1);
    expect(typeof ports[0]).toBe("number");
  });

  test("finds ports starting from specific port", async () => {
    const count = 3;
    const startPort = 31000;
    
    const ports = await getOpenPorts({ count, startPort });
    
    expect(ports).toHaveLength(count);
    expect(ports.every(port => port >= startPort)).toBe(true);
    expect(ports.every(port => port <= 32767)).toBe(true);
  });
});