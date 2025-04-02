import { existsSync, writeFileSync, unlinkSync } from "fs";
import { Writable, Readable } from "stream";
import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { extractRoute53ZoneKeys } from "./extract-route53-zone-keys";
import type { BaseContext } from "clipanion";

describe("extractRoute53ZoneKeys", () => {
  const testFilePath = "./test-hcl-file.hcl";

  // Create a minimal mock of BaseContext that satisfies type requirements
  const mockContext: BaseContext = {
    stdout: new Writable({ write: () => true }),
    stderr: new Writable({ write: () => true }),
    stdin: new Readable({ read: () => {} }),
    env: process.env,
    colorDepth: 1,
  };

  // Clean up any existing test file before each test
  beforeEach(() => {
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
  });

  // Clean up after each test
  afterEach(() => {
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
  });

  test("should extract keys from valid HCL file", () => {
    const validHcl = `
      include "panfactum" {
        path   = find_in_parent_folders("panfactum.hcl")
        expose = true
      }
      
      inputs = {
        alert_email = "it@panfactum.com"
        
        route53_zones = {
          "dev.panfactum.com" = {
            zone_id = "Z061599010VQ7E1NYZA52"
          }
          "development.panfactum.com" = {
            zone_id = "Z00914472Z7HO5DHUBPV1"
          }
        }
      }
    `;

    writeFileSync(testFilePath, validHcl);
    const result = extractRoute53ZoneKeys({
      filePath: testFilePath,
      context: mockContext,
    });

    expect(result).toHaveLength(2);
    expect(result).toContain("dev.panfactum.com");
    expect(result).toContain("development.panfactum.com");
  });

  test("should handle multiple keys with varied formatting", () => {
    const hclWithDifferentFormatting = `
      inputs = {
        route53_zones = {
          "dev.panfactum.com"={
            zone_id="Z123"
          }
          "staging.panfactum.com" = {
            zone_id = "Z456"
          }
          "prod.panfactum.com"=
          {
            zone_id="Z789"
          }
        }
      }
    `;

    writeFileSync(testFilePath, hclWithDifferentFormatting);
    const result = extractRoute53ZoneKeys({
      filePath: testFilePath,
      context: mockContext,
    });

    expect(result).toHaveLength(3);
    expect(result).toContain("dev.panfactum.com");
    expect(result).toContain("staging.panfactum.com");
    expect(result).toContain("prod.panfactum.com");
  });

  test("should return empty array when no route53_zones section exists", () => {
    const hclWithoutRouteZones = `
      include "panfactum" {
        path = find_in_parent_folders("panfactum.hcl")
      }
      
      inputs = {
        some_other_setting = "value"
      }
    `;

    writeFileSync(testFilePath, hclWithoutRouteZones);
    const result = extractRoute53ZoneKeys({
      filePath: testFilePath,
      context: mockContext,
    });

    expect(result).toHaveLength(0);
  });

  test("should return empty array when route53_zones is empty", () => {
    const hclWithEmptyRouteZones = `
      inputs = {
        route53_zones = {}
      }
    `;

    writeFileSync(testFilePath, hclWithEmptyRouteZones);
    const result = extractRoute53ZoneKeys({
      filePath: testFilePath,
      context: mockContext,
    });

    expect(result).toHaveLength(0);
  });

  test("should handle non-existent file", () => {
    const result = extractRoute53ZoneKeys({
      filePath: "./non-existent-file.hcl",
      context: mockContext,
    });
    expect(result).toHaveLength(0);
  });
});
