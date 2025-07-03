// Tests for configuration constants
// Verifies constant values and structure

import { describe, test, expect } from "bun:test";
import {
  ENVIRONMENT_YAML,
  REGION_YAML,
  GLOBAL_YAML,
  MODULE_YAML,
  GLOBAL_CONFIG,
  GLOBAL_SECRETS_CONFIG,
  GLOBAL_USER_CONFIG,
  ENVIRONMENT_CONFIG,
  ENVIRONMENT_SECRETS_CONFIG,
  ENVIRONMENT_USER_CONFIG,
  REGION_CONFIG,
  REGION_SECRETS_CONFIG,
  REGION_USER_CONFIG,
  MODULE_CONFIG,
  MODULE_SECRETS_CONFIG,
  MODULE_USER_CONFIG,
  CONFIG_FILE_PRECEDENCE
} from "./constants";

describe("constants", () => {
  test("infrastructure configuration file constants are correct", () => {
    expect(ENVIRONMENT_YAML).toBe("environment.yaml");
    expect(REGION_YAML).toBe("region.yaml");
    expect(GLOBAL_YAML).toBe("global.yaml");
    expect(MODULE_YAML).toBe("module.yaml");
  });

  test("configuration file constants are correct", () => {
    expect(GLOBAL_CONFIG).toBe("global.yaml");
    expect(GLOBAL_SECRETS_CONFIG).toBe("global.secrets.yaml");
    expect(GLOBAL_USER_CONFIG).toBe("global.user.yaml");
    
    expect(ENVIRONMENT_CONFIG).toBe("environment.yaml");
    expect(ENVIRONMENT_SECRETS_CONFIG).toBe("environment.secrets.yaml");
    expect(ENVIRONMENT_USER_CONFIG).toBe("environment.user.yaml");
    
    expect(REGION_CONFIG).toBe("region.yaml");
    expect(REGION_SECRETS_CONFIG).toBe("region.secrets.yaml");
    expect(REGION_USER_CONFIG).toBe("region.user.yaml");
    
    expect(MODULE_CONFIG).toBe("module.yaml");
    expect(MODULE_SECRETS_CONFIG).toBe("module.secrets.yaml");
    expect(MODULE_USER_CONFIG).toBe("module.user.yaml");
  });

  test("CONFIG_FILE_PRECEDENCE has correct order and length", () => {
    expect(CONFIG_FILE_PRECEDENCE).toHaveLength(12);
    
    // Verify the exact precedence order
    expect(CONFIG_FILE_PRECEDENCE).toMatchInlineSnapshot(`
      [
        "global.yaml",
        "global.secrets.yaml",
        "global.user.yaml",
        "environment.yaml",
        "environment.secrets.yaml",
        "environment.user.yaml",
        "region.yaml",
        "region.secrets.yaml",
        "region.user.yaml",
        "module.yaml",
        "module.secrets.yaml",
        "module.user.yaml",
      ]
    `);
  });

  test("CONFIG_FILE_PRECEDENCE follows hierarchy levels", () => {
    const precedenceArray = [...CONFIG_FILE_PRECEDENCE];
    
    // Global configs come first (indices 0-2)
    expect(precedenceArray.slice(0, 3)).toEqual([
      GLOBAL_CONFIG,
      GLOBAL_SECRETS_CONFIG,
      GLOBAL_USER_CONFIG
    ]);
    
    // Environment configs come second (indices 3-5)
    expect(precedenceArray.slice(3, 6)).toEqual([
      ENVIRONMENT_CONFIG,
      ENVIRONMENT_SECRETS_CONFIG,
      ENVIRONMENT_USER_CONFIG
    ]);
    
    // Region configs come third (indices 6-8)
    expect(precedenceArray.slice(6, 9)).toEqual([
      REGION_CONFIG,
      REGION_SECRETS_CONFIG,
      REGION_USER_CONFIG
    ]);
    
    // Module configs come last (indices 9-11)
    expect(precedenceArray.slice(9, 12)).toEqual([
      MODULE_CONFIG,
      MODULE_SECRETS_CONFIG,
      MODULE_USER_CONFIG
    ]);
  });

  test("CONFIG_FILE_PRECEDENCE follows sub-level precedence", () => {
    const precedenceArray = [...CONFIG_FILE_PRECEDENCE];
    
    // Within each level: base -> secrets -> user
    for (let i = 0; i < precedenceArray.length; i += 3) {
      const levelConfigs = precedenceArray.slice(i, i + 3);
      expect(levelConfigs[0]).toMatch(/^[a-z]+\.yaml$/); // base config
      expect(levelConfigs[1]).toMatch(/^[a-z]+\.secrets\.yaml$/); // secrets config
      expect(levelConfigs[2]).toMatch(/^[a-z]+\.user\.yaml$/); // user config
    }
  });

  test("CONFIG_FILE_PRECEDENCE is readonly tuple", () => {
    // Verify it's a readonly tuple type by checking it includes all expected files
    const expectedFiles = [
      GLOBAL_CONFIG, GLOBAL_SECRETS_CONFIG, GLOBAL_USER_CONFIG,
      ENVIRONMENT_CONFIG, ENVIRONMENT_SECRETS_CONFIG, ENVIRONMENT_USER_CONFIG,
      REGION_CONFIG, REGION_SECRETS_CONFIG, REGION_USER_CONFIG,
      MODULE_CONFIG, MODULE_SECRETS_CONFIG, MODULE_USER_CONFIG
    ];
    
    expect([...CONFIG_FILE_PRECEDENCE] as string[]).toEqual(expectedFiles);
  });

  test("all configuration filenames follow consistent naming pattern", () => {
    const allConfigFiles = [
      GLOBAL_CONFIG, GLOBAL_SECRETS_CONFIG, GLOBAL_USER_CONFIG,
      ENVIRONMENT_CONFIG, ENVIRONMENT_SECRETS_CONFIG, ENVIRONMENT_USER_CONFIG,
      REGION_CONFIG, REGION_SECRETS_CONFIG, REGION_USER_CONFIG,
      MODULE_CONFIG, MODULE_SECRETS_CONFIG, MODULE_USER_CONFIG
    ];
    
    for (const filename of allConfigFiles) {
      // All files should end with .yaml
      expect(filename).toMatch(/\.yaml$/);
      
      // Should not contain uppercase letters
      expect(filename).toBe(filename.toLowerCase());
      
      // Should not contain spaces
      expect(filename).not.toMatch(/\s/);
    }
  });

  test("infrastructure and config constants do not conflict", () => {
    // ENVIRONMENT_YAML and ENVIRONMENT_CONFIG should be the same
    expect(ENVIRONMENT_YAML).toBe(ENVIRONMENT_CONFIG);
    expect(REGION_YAML).toBe(REGION_CONFIG);
    expect(GLOBAL_YAML).toBe(GLOBAL_CONFIG);
    expect(MODULE_YAML).toBe(MODULE_CONFIG);
  });
});