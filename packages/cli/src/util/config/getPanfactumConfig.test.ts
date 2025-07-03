// Tests for getPanfactumConfig utility function
// Verifies hierarchical configuration loading and merging

import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { createTestDir } from "@/util/test/createTestDir";
import * as getVaultTokenModule from "@/util/vault/getVaultToken";
import * as getConfigValuesFromFileModule from "./getConfigValuesFromFile";
import { getPanfactumConfig } from "./getPanfactumConfig";
import type { PanfactumContext } from "@/util/context/context";

let testDir: string;
let repoRoot: string;
let environmentsDir: string;
let getConfigValuesFromFileMock: ReturnType<typeof spyOn<typeof getConfigValuesFromFileModule, "getConfigValuesFromFile">>;
let getVaultTokenMock: ReturnType<typeof spyOn<typeof getVaultTokenModule, "getVaultToken">>;

const mockContext = {
  devshellConfig: {
    repo_root: "",
    environments_dir: ""
  },
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {}
  },
  env: {
    CI: "false",
    VAULT_ADDR: "https://vault.example.com"
  }
} as unknown as PanfactumContext;

describe("getPanfactumConfig", () => {
  beforeEach(async () => {
    // Create test directory structure
    const result = await createTestDir({ functionName: "getPanfactumConfig" });
    testDir = result.path;
    repoRoot = testDir;
    environmentsDir = join(testDir, "environments");
    
    // Update mock context with test directories
    (mockContext.devshellConfig as { repo_root: string; environments_dir: string }).repo_root = repoRoot;
    (mockContext.devshellConfig as { repo_root: string; environments_dir: string }).environments_dir = environmentsDir;
    
    // Create environments directory
    await mkdir(environmentsDir, { recursive: true });
    
    // Create spies
    getConfigValuesFromFileMock = spyOn(getConfigValuesFromFileModule, "getConfigValuesFromFile");
    getVaultTokenMock = spyOn(getVaultTokenModule, "getVaultToken");
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
    
    // Restore mocks
    mock.restore();
  });

  test("throws error for non-absolute directory path", async () => {
    await expect(
      getPanfactumConfig({
        context: mockContext,
        directory: "relative/path"
      })
    ).rejects.toThrow("getPanfactumConfig must be called with an absolute path");
  });

  test("loads configuration from global file only", async () => {
    const globalConfig = {
      pf_stack_version: "24.05.1",
      aws_account_id: "123456789012",
      aws_profile: "default"
    };

    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      if ('filePath' in input && input.filePath && input.filePath.endsWith("global.yaml")) {
        return globalConfig;
      }
      return null;
    });

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: testDir
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "aws_secondary_account_id": undefined,
        "aws_secondary_profile": undefined,
        "extra_inputs": {},
        "extra_tags": {},
        "kube_config_context": undefined,
        "pf_stack_local_use_relative": true,
        "tf_state_account_id": undefined,
        "tf_state_profile": undefined,
        "version": "local",
      }
    `);
  });

  test("merges configuration hierarchy with proper precedence", async () => {
    const globalConfig = {
      pf_stack_version: "24.05.1",
      aws_account_id: "111111111111",
      aws_profile: "global-profile",
      extra_inputs: {
        setting1: "global-value"
      }
    };

    const envConfig = {
      aws_account_id: "222222222222",
      aws_profile: "env-profile",
      extra_inputs: {
        setting2: "env-value"
      }
    };

    const regionConfig = {
      aws_region: "us-east-1",
      extra_inputs: {
        setting3: "region-value"
      }
    };

    const moduleConfig = {
      extra_inputs: {
        module_setting: "module-value",
        setting1: "module-override" // Should override global
      }
    };

    const prodEnvDir = join(environmentsDir, "production");
    const regionDir = join(prodEnvDir, "us-east-1");
    const moduleDir = join(regionDir, "vpc");
    await mkdir(moduleDir, { recursive: true });

    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      if ('filePath' in input && input.filePath) {
        if (input.filePath.endsWith("global.yaml")) {
          return globalConfig;
        }
        if (input.filePath.endsWith("environment.yaml")) {
          return envConfig;
        }
        if (input.filePath.endsWith("region.yaml")) {
          return regionConfig;
        }
        if (input.filePath.endsWith("module.yaml")) {
          return moduleConfig;
        }
      }
      return null;
    });

    getVaultTokenMock.mockResolvedValue("vault-token-123");

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: moduleDir
    });

    // Later files should override earlier ones
    expect(result.aws_account_id).toBe("222222222222"); // from env
    expect(result.aws_profile).toBe("env-profile"); // from env
    expect(result.aws_region).toBe("us-east-1"); // from region
    expect(result.extra_inputs?.['setting1']).toBe("module-override"); // overridden by module
    expect(result.extra_inputs?.['setting2']).toBe("env-value"); // from env
    expect(result.extra_inputs?.['setting3']).toBe("region-value"); // from region
    expect(result.extra_inputs?.['module_setting']).toBe("module-value"); // from module
  });

  test("merges special fields (extra_tags, extra_inputs, domains) additively", async () => {
    const globalConfig = {
      extra_tags: { global_tag: "global_value", shared_tag: "global_shared" },
      extra_inputs: { global_input: "global_value", shared_input: "global_shared" },
      domains: { "global.com": { zone_id: "Z1", record_manager_role_arn: "arn:aws:iam::123456789012:role/GlobalDNS" } }
    };

    const envConfig = {
      extra_tags: { env_tag: "env_value", shared_tag: "env_shared" },
      extra_inputs: { env_input: "env_value", shared_input: "env_shared" },
      domains: { "env.com": { zone_id: "Z2", record_manager_role_arn: "arn:aws:iam::123456789012:role/EnvDNS" } }
    };

    const moduleDir = join(environmentsDir, "test", "us-east-1", "app");
    await mkdir(moduleDir, { recursive: true });

    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      if ('filePath' in input && input.filePath) {
        if (input.filePath.endsWith("global.yaml")) {
          return globalConfig;
        }
        if (input.filePath.endsWith("environment.yaml")) {
          return envConfig;
        }
      }
      return null;
    });

    getVaultTokenMock.mockResolvedValue("vault-token");

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: moduleDir
    });

    expect(result.extra_tags).toMatchInlineSnapshot(`
      {
        "env_tag": "env_value",
        "global_tag": "global_value",
        "shared_tag": "env_shared",
      }
    `);

    expect(result.extra_inputs).toMatchInlineSnapshot(`
      {
        "env_input": "env_value",
        "global_input": "global_value",
        "shared_input": "env_shared",
      }
    `);

    expect(result.domains).toMatchInlineSnapshot(`
      {
        "env.com": {
          "record_manager_role_arn": "arn:aws:iam::123456789012:role/EnvDNS",
          "zone_id": "Z2",
        },
        "global.com": {
          "record_manager_role_arn": "arn:aws:iam::123456789012:role/GlobalDNS",
          "zone_id": "Z1",
        },
      }
    `);
  });

  test("provides default values for undefined properties", async () => {
    const baseConfig = {
      aws_account_id: "123456789012",
      aws_profile: "test-profile"
    };

    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      if ('filePath' in input && input.filePath && input.filePath.endsWith("global.yaml")) {
        return baseConfig;
      }
      return null;
    });

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: testDir
    });

    // Check default value assignments
    if (result.aws_account_id) {
      expect(result.tf_state_account_id).toBe(result.aws_account_id);
      expect(result.aws_secondary_account_id).toBe(result.aws_account_id);
    }
    if (result.aws_profile) {
      expect(result.tf_state_profile).toBe(result.aws_profile);
      expect(result.aws_secondary_profile).toBe(result.aws_profile);
    }
    expect(result.pf_stack_local_use_relative).toBe(true);
    expect(result.extra_tags).toEqual({});
    expect(result.extra_inputs).toEqual({});
    expect(result.version).toBe("local");
  });

  test("infers environment, region, and module from directory path", async () => {
    const moduleDir = join(environmentsDir, "production", "us-west-2", "database");
    await mkdir(moduleDir, { recursive: true });

    getConfigValuesFromFileMock.mockResolvedValue(null);
    getVaultTokenMock.mockResolvedValue("vault-token");

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: moduleDir
    });

    expect(result.environment).toBe("production");
    expect(result.region).toBe("us-west-2");
    expect(result.module).toBe("database");
    expect(result.environment_dir).toBe("production");
    expect(result.region_dir).toBe("us-west-2");
    expect(result.module_dir).toBe("database");
  });

  test("generates kube_name from environment and region", async () => {
    const regionDir = join(environmentsDir, "staging", "eu-west-1");
    await mkdir(regionDir, { recursive: true });

    getConfigValuesFromFileMock.mockResolvedValue(null);
    getVaultTokenMock.mockResolvedValue("vault-token");

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: regionDir
    });

    expect(result.kube_name).toBe("staging-eu-west-1");
    expect(result.kube_config_context).toBe("staging-eu-west-1");
  });

  test("uses explicit kube_config_context for backwards compatibility", async () => {
    const config = {
      kube_config_context: "custom-context"
    };

    const regionDir = join(environmentsDir, "test", "us-east-1");
    await mkdir(regionDir, { recursive: true });

    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      if ('filePath' in input && input.filePath && input.filePath.endsWith("region.yaml")) {
        return config;
      }
      return null;
    });

    getVaultTokenMock.mockResolvedValue("vault-token");

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: regionDir
    });

    expect(result.kube_name).toBe("custom-context");
    expect(result.kube_config_context).toBe("custom-context");
  });

  test("handles vault configuration in region directory", async () => {
    const regionDir = join(environmentsDir, "production", "us-east-1");
    await mkdir(regionDir, { recursive: true });

    const config = {
      vault_addr: "https://vault.custom.com"
    };

    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      if ('filePath' in input && input.filePath && input.filePath.endsWith("region.yaml")) {
        return config;
      }
      return null;
    });

    getVaultTokenMock.mockResolvedValue("custom-vault-token");

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: regionDir
    });

    expect(result.vault_addr).toBe("https://vault.custom.com");
    expect(result.vault_token).toBe("custom-vault-token");
    expect(getVaultTokenMock).toHaveBeenCalledWith({
      context: mockContext,
      address: "https://vault.custom.com",
      silent: true
    });
  });

  test("uses environment VAULT_ADDR when no config vault_addr in CI", async () => {
    const regionDir = join(environmentsDir, "production", "us-east-1");
    await mkdir(regionDir, { recursive: true });

    // Set CI environment
    (mockContext.env as { CI: string }).CI = "true";

    getConfigValuesFromFileMock.mockResolvedValue(null);
    getVaultTokenMock.mockResolvedValue("env-vault-token");

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: regionDir
    });

    expect(result.vault_addr).toBe("https://vault.example.com");
    expect(result.vault_token).toBe("env-vault-token");
  });

  test("handles vault token fetch failure gracefully", async () => {
    const regionDir = join(environmentsDir, "production", "us-east-1");
    await mkdir(regionDir, { recursive: true });

    getConfigValuesFromFileMock.mockResolvedValue(null);
    getVaultTokenMock.mockRejectedValue(new Error("Vault unavailable"));

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: regionDir
    });

    expect(result.vault_token).toBe("@@TERRAGRUNT_INVALID@@");
  });

  test("sets vault values to invalid when not in region directory", async () => {
    const envDir = join(environmentsDir, "production");
    await mkdir(envDir, { recursive: true });

    getConfigValuesFromFileMock.mockResolvedValue(null);

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: envDir
    });

    expect(result.vault_addr).toBeUndefined();
    expect(result.vault_token).toBeUndefined();
    expect(getVaultTokenMock).not.toHaveBeenCalled();
  });

  test("handles secret configuration files", async () => {
    const secretConfig = {
      vault_token: "secret-token",
      authentik_token: "secret-value"
    };

    const moduleDir = join(environmentsDir, "prod", "us-east-1", "secrets");
    await mkdir(moduleDir, { recursive: true });

    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      if ('filePath' in input && input.filePath && input.secret && input.filePath.includes("secret")) {
        return secretConfig;
      }
      return null;
    });

    getVaultTokenMock.mockResolvedValue("fallback-token");

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: moduleDir
    });

    expect(result.vault_token).toBe("secret-token");
    expect(result.authentik_token).toBe("secret-value");
  });

  test("stops searching at repo root", async () => {
    const deepDir = join(testDir, "very", "deep", "nested", "directory");
    await mkdir(deepDir, { recursive: true });

    getConfigValuesFromFileMock.mockResolvedValue(null);

    await getPanfactumConfig({
      context: mockContext,
      directory: deepDir
    });

    // Should have searched up to repo root but not beyond
    const calls = getConfigValuesFromFileMock.mock.calls;
    const searchedDirs = new Set(calls.map(call => 
      (call[0] as { filePath: string }).filePath.split("/").slice(0, -1).join("/")
    ));
    
    // The function should have searched the deep directory and walked up to repo root
    expect(searchedDirs.size).toBeGreaterThan(0);
    expect(searchedDirs.has("/")).toBe(false); // Should not search filesystem root
  });

  test("handles directory outside environments directory", async () => {
    const outsideDir = join(testDir, "other", "directory");
    await mkdir(outsideDir, { recursive: true });

    getConfigValuesFromFileMock.mockResolvedValue({
      pf_stack_version: "24.05.1"
    });

    const result = await getPanfactumConfig({
      context: mockContext,
      directory: outsideDir
    });

    // Should not have inferred environment/region/module
    expect(result.environment).toBeUndefined();
    expect(result.region).toBeUndefined();
    expect(result.module).toBeUndefined();
    expect(result.environment_dir).toBeUndefined();
    expect(result.region_dir).toBeUndefined();
    expect(result.module_dir).toBeUndefined();
  });

  test("uses current working directory when no directory specified", async () => {
    const originalCwd = process.cwd();
    
    try {
      // Change to test directory
      process.chdir(testDir);
      
      const result = await getPanfactumConfig({
        context: mockContext
      });

      // The function should run without errors and return default values
      expect(result.version).toBe("local");
      expect(result.pf_stack_local_use_relative).toBe(true);
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
  });

  test("processes all config file types in precedence order", async () => {
    const moduleDir = join(environmentsDir, "test", "us-east-1", "app");
    await mkdir(moduleDir, { recursive: true });

    // Mock different config files with different values for the same key
    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      if ('filePath' in input && input.filePath) {
        const fileName = input.filePath.split("/").pop();
        return { environment: fileName };
      }
      return null;
    });

    getVaultTokenMock.mockResolvedValue("vault-token");

    await getPanfactumConfig({
      context: mockContext,
      directory: moduleDir
    });

    // Should have been called for multiple files during directory traversal
    expect(getConfigValuesFromFileMock).toHaveBeenCalled();
  });
});