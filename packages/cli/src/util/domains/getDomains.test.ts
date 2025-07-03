import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { test, expect, mock, describe, beforeEach, afterEach, spyOn } from "bun:test";
import yaml from "yaml";
import * as getPanfactumConfigModule from "@/util/config/getPanfactumConfig";
import * as isEnvironmentDeployedModule from "@/util/config/isEnvironmentDeployed";
import { CLIError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";
import { getDomains } from "./getDomains";
import type { PanfactumContext } from "@/util/context/context";

// Constants to avoid duplication
const US_EAST_1 = "us-east-1";
const AWS_ACCOUNT_ID = "123456789012";
const ENVIRONMENT_YAML = "environment.yaml";
const GLOBAL_YAML = "global.yaml";
const REGION_YAML = "region.yaml";

// Helper to create a mock context
const createMockContext = (environmentsDir: string): PanfactumContext => ({
    logger: {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {})
    },
    devshellConfig: {
        environments_dir: environmentsDir,
        repo_root: dirname(environmentsDir), // Set repo root to parent of environments dir
        repo_name: "test-repo",
        tf_modules_dir: "/mock/modules",
        kube_dir: "/mock/kube"
    }
} as unknown as PanfactumContext);

// Helper to create test environment.yaml content
const createEnvironmentYaml = (config: {
    environment?: string;
    domains?: Record<string, { zone_id: string; record_manager_role_arn: string }>;
    aws_account_id?: string;
    aws_region?: string;
}) => {
    const yamlObj: Record<string, unknown> = {};
    
    if (config.environment) {
        yamlObj["environment"] = config.environment;
    }
    
    if (config.aws_account_id) {
        yamlObj["aws_account_id"] = config.aws_account_id;
    }
    
    if (config.aws_region) {
        yamlObj["aws_region"] = config.aws_region;
    }
    
    if (config.domains) {
        yamlObj["domains"] = config.domains;
    }
    
    return yaml.stringify(yamlObj);
};

// Helper to create global.yaml content
const createGlobalYaml = () => {
    return yaml.stringify({
        tf_state_account_id: AWS_ACCOUNT_ID,
        tf_state_region: US_EAST_1,
        tf_state_bucket: "test-tf-state"
    });
};

// Helper to normalize paths in snapshots (replace dynamic temp paths with placeholders)
const normalizeSnapshot = (result: Record<string, unknown>): Record<string, unknown> => {
    const normalized = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    
    // Replace dynamic paths with stable placeholders
    const replacePath = (obj: unknown): unknown => {
        if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
                return obj.map(replacePath);
            }
            
            const newObj: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
                if (key === 'path' && typeof value === 'string') {
                    // Replace temp directory paths with a stable placeholder
                    newObj[key] = value.replace(/^.*\/getDomains-[^/]+/, '<temp-dir>');
                } else {
                    newObj[key] = replacePath(value);
                }
            }
            return newObj;
        }
        return obj;
    };
    
    return replacePath(normalized) as Record<string, unknown>;
};

describe("getDomains", () => {
  let isEnvironmentDeployedMock: ReturnType<typeof spyOn<typeof isEnvironmentDeployedModule, "isEnvironmentDeployed">>;
  let getPanfactumConfigMock: ReturnType<typeof spyOn<typeof getPanfactumConfigModule, "getPanfactumConfig">>;

  beforeEach(() => {
    // Create spies for module functions
    isEnvironmentDeployedMock = spyOn(isEnvironmentDeployedModule, "isEnvironmentDeployed");
    isEnvironmentDeployedMock.mockResolvedValue(false);
    
    getPanfactumConfigMock = spyOn(getPanfactumConfigModule, "getPanfactumConfig");
    getPanfactumConfigMock.mockImplementation(async (input) => {
      const directory = input.directory || "";
      const envYamlPath = join(directory, ENVIRONMENT_YAML);
      try {
        const content = await Bun.file(envYamlPath).text();
        const parsed = yaml.parse(content) as Record<string, unknown>;
        return {
          ...parsed,
          environment_dir: dirname(envYamlPath).split("/").pop(),
          tf_state_region: US_EAST_1
        };
      } catch {
        return {
          tf_state_region: US_EAST_1
        };
      }
    });
  });

  afterEach(() => {
    // Restore the mocked module functions
    mock.restore();
  });
  test("returns empty object when no environment.yaml files exist", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    
    try {
        await mkdir(environmentsDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        const context = createMockContext(environmentsDir);
        
        const result = await getDomains({ context });
        
        expect(result).toMatchInlineSnapshot(`{}`)
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("extracts domains from single environment", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const prodDir = join(environmentsDir, "production");
    
    try {
        await mkdir(prodDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create environment.yaml with domains
        await writeFile(
            join(prodDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "production",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: US_EAST_1,
                domains: {
                    "example.com": {
                        zone_id: "Z1234567890ABC",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/DNSManager`
                    },
                    "api.example.com": {
                        zone_id: "Z0987654321XYZ",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/DNSManager`
                    }
                }
            })
        );
        
        // Create region.yaml for completeness
        await writeFile(
            join(prodDir, REGION_YAML),
            yaml.stringify({ region: US_EAST_1 })
        );
        
        const context = createMockContext(environmentsDir);
        const result = await getDomains({ context });
        
        // Normalize paths before snapshot
        const normalized = normalizeSnapshot(result);
        expect(normalized).toMatchInlineSnapshot(`
            {
              "api.example.com": {
                "domain": "api.example.com",
                "env": {
                  "deployed": false,
                  "name": "production",
                  "path": "<temp-dir>/environments/production",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/DNSManager",
                "zoneId": "Z0987654321XYZ",
              },
              "example.com": {
                "domain": "example.com",
                "env": {
                  "deployed": false,
                  "name": "production",
                  "path": "<temp-dir>/environments/production",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/DNSManager",
                "zoneId": "Z1234567890ABC",
              },
            }
        `);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("merges domains from multiple environments", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const prodDir = join(environmentsDir, "production");
    const stagingDir = join(environmentsDir, "staging");
    
    try {
        await mkdir(prodDir, { recursive: true });
        await mkdir(stagingDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create production environment.yaml
        await writeFile(
            join(prodDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "production",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: US_EAST_1,
                domains: {
                    "example.com": {
                        zone_id: "Z1111111111111",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/ProdDNS`
                    }
                }
            })
        );
        
        await writeFile(
            join(prodDir, REGION_YAML),
            yaml.stringify({ region: US_EAST_1 })
        );
        
        // Create staging environment.yaml
        await writeFile(
            join(stagingDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "staging",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: US_EAST_1,
                domains: {
                    "staging.example.com": {
                        zone_id: "Z2222222222222",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/StagingDNS`
                    }
                }
            })
        );
        
        await writeFile(
            join(stagingDir, REGION_YAML),
            yaml.stringify({ region: US_EAST_1 })
        );
        
        const context = createMockContext(environmentsDir);
        const result = await getDomains({ context });
        
        const normalized = normalizeSnapshot(result);
        expect(normalized).toMatchInlineSnapshot(`
            {
              "example.com": {
                "domain": "example.com",
                "env": {
                  "deployed": false,
                  "name": "production",
                  "path": "<temp-dir>/environments/production",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/ProdDNS",
                "zoneId": "Z1111111111111",
              },
              "staging.example.com": {
                "domain": "staging.example.com",
                "env": {
                  "deployed": false,
                  "name": "staging",
                  "path": "<temp-dir>/environments/staging",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/StagingDNS",
                "zoneId": "Z2222222222222",
              },
            }
        `);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles environment.yaml without domains", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const devDir = join(environmentsDir, "development");
    
    try {
        await mkdir(devDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create environment.yaml without domains
        await writeFile(
            join(devDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "development",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: "us-west-2"
            })
        );
        
        await writeFile(
            join(devDir, REGION_YAML),
            yaml.stringify({ region: "us-west-2" })
        );
        
        const context = createMockContext(environmentsDir);
        const result = await getDomains({ context });
        
        expect(result).toMatchInlineSnapshot(`{}`)
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("throws CLIError when environment name is missing", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const envDir = join(environmentsDir, "broken");
    
    try {
        await mkdir(envDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create environment.yaml with domains but no environment name
        await writeFile(
            join(envDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: US_EAST_1,
                domains: {
                    "broken.com": {
                        zone_id: "Z3333333333333",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/DNS`
                    }
                }
            })
        );
        
        const context = createMockContext(environmentsDir);
        
        await expect(getDomains({ context })).rejects.toThrow(CLIError);
        await expect(getDomains({ context })).rejects.toThrow("Unknown environment");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("processes nested environment directories", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const nestedDir = join(environmentsDir, "group1", "subgroup", "prod");
    
    try {
        await mkdir(nestedDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create environment.yaml in nested directory
        await writeFile(
            join(nestedDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "nested-prod",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: "eu-west-1",
                domains: {
                    "nested.example.com": {
                        zone_id: "Z4444444444444",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/NestedDNS`
                    }
                }
            })
        );
        
        await writeFile(
            join(nestedDir, REGION_YAML),
            yaml.stringify({ region: "eu-west-1" })
        );
        
        const context = createMockContext(environmentsDir);
        const result = await getDomains({ context });
        
        const normalized = normalizeSnapshot(result);
        expect(normalized).toMatchInlineSnapshot(`
            {
              "nested.example.com": {
                "domain": "nested.example.com",
                "env": {
                  "deployed": false,
                  "name": "nested-prod",
                  "path": "<temp-dir>/environments/group1/subgroup/prod",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/NestedDNS",
                "zoneId": "Z4444444444444",
              },
            }
        `);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles domain with special characters in config", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const envDir = join(environmentsDir, "special");
    
    try {
        await mkdir(envDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create environment.yaml with domain containing dashes
        await writeFile(
            join(envDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "special-env",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: "ap-south-1",
                domains: {
                    "my-special-domain.example.com": {
                        zone_id: "Z5555555555555",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/SpecialDNS`
                    }
                }
            })
        );
        
        await writeFile(
            join(envDir, REGION_YAML),
            yaml.stringify({ region: "ap-south-1" })
        );
        
        const context = createMockContext(environmentsDir);
        const result = await getDomains({ context });
        
        const normalized = normalizeSnapshot(result);
        expect(normalized).toMatchInlineSnapshot(`
            {
              "my-special-domain.example.com": {
                "domain": "my-special-domain.example.com",
                "env": {
                  "deployed": false,
                  "name": "special-env",
                  "path": "<temp-dir>/environments/special",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/SpecialDNS",
                "zoneId": "Z5555555555555",
              },
            }
        `);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles multiple domains in same environment", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const multiDir = join(environmentsDir, "multi");
    
    try {
        await mkdir(multiDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create environment.yaml with multiple domains
        await writeFile(
            join(multiDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "multi-domain",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: US_EAST_1,
                domains: {
                    "domain1.com": {
                        zone_id: "Z6666666666666",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/DNS1`
                    },
                    "domain2.com": {
                        zone_id: "Z7777777777777",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/DNS2`
                    },
                    "subdomain.domain1.com": {
                        zone_id: "Z8888888888888",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/DNS3`
                    }
                }
            })
        );
        
        await writeFile(
            join(multiDir, REGION_YAML),
            yaml.stringify({ region: US_EAST_1 })
        );
        
        const context = createMockContext(environmentsDir);
        const result = await getDomains({ context });
        
        const normalized = normalizeSnapshot(result);
        expect(normalized).toMatchInlineSnapshot(`
            {
              "domain1.com": {
                "domain": "domain1.com",
                "env": {
                  "deployed": false,
                  "name": "multi-domain",
                  "path": "<temp-dir>/environments/multi",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/DNS1",
                "zoneId": "Z6666666666666",
              },
              "domain2.com": {
                "domain": "domain2.com",
                "env": {
                  "deployed": false,
                  "name": "multi-domain",
                  "path": "<temp-dir>/environments/multi",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/DNS2",
                "zoneId": "Z7777777777777",
              },
              "subdomain.domain1.com": {
                "domain": "subdomain.domain1.com",
                "env": {
                  "deployed": false,
                  "name": "multi-domain",
                  "path": "<temp-dir>/environments/multi",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/DNS3",
                "zoneId": "Z8888888888888",
              },
            }
        `);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("ignores non-environment.yaml files", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const envDir = join(environmentsDir, "test");
    
    try {
        await mkdir(envDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create various files that should be ignored
        await writeFile(join(envDir, "README.md"), "# Test Environment");
        await writeFile(join(envDir, "config.yaml"), yaml.stringify({ some: "config" }));
        await writeFile(join(envDir, "environment.yml"), yaml.stringify({ environment: "wrong-extension" }));
        await writeFile(join(envDir, "extra-global.yaml"), yaml.stringify({ global: "config" }));
        
        // Create valid environment.yaml
        await writeFile(
            join(envDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "test",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: US_EAST_1,
                domains: {
                    "test.com": {
                        zone_id: "Z9999999999999",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/TestDNS`
                    }
                }
            })
        );
        
        await writeFile(
            join(envDir, REGION_YAML),
            yaml.stringify({ region: US_EAST_1 })
        );
        
        const context = createMockContext(environmentsDir);
        const result = await getDomains({ context });
        
        const normalized = normalizeSnapshot(result);
        expect(normalized).toMatchInlineSnapshot(`
            {
              "test.com": {
                "domain": "test.com",
                "env": {
                  "deployed": false,
                  "name": "test",
                  "path": "<temp-dir>/environments/test",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/TestDNS",
                "zoneId": "Z9999999999999",
              },
            }
        `);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles empty domains object in environment.yaml", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const emptyDir = join(environmentsDir, "empty");
    
    try {
        await mkdir(emptyDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create environment.yaml with empty domains object
        await writeFile(
            join(emptyDir, ENVIRONMENT_YAML),
            yaml.stringify({
                environment: "empty-domains",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: US_EAST_1,
                domains: {}
            })
        );
        
        await writeFile(
            join(emptyDir, REGION_YAML),
            yaml.stringify({ region: US_EAST_1 })
        );
        
        const context = createMockContext(environmentsDir);
        const result = await getDomains({ context });
        
        expect(result).toMatchInlineSnapshot(`{}`)
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("updates deployed status based on isEnvironmentDeployed", async () => {
    const { path: testDir } = await createTestDir({ functionName: "getDomains" });
    const environmentsDir = join(testDir, "environments");
    const prodDir = join(environmentsDir, "production");
    const stagingDir = join(environmentsDir, "staging");
    
    try {
        await mkdir(prodDir, { recursive: true });
        await mkdir(stagingDir, { recursive: true });
        
        // Create global.yaml in environments directory
        await writeFile(
            join(environmentsDir, GLOBAL_YAML),
            createGlobalYaml()
        );
        
        // Create production environment.yaml
        await writeFile(
            join(prodDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "production",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: US_EAST_1,
                domains: {
                    "example.com": {
                        zone_id: "Z1111111111111",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/ProdDNS`
                    }
                }
            })
        );
        
        await writeFile(
            join(prodDir, REGION_YAML),
            yaml.stringify({ region: US_EAST_1 })
        );
        
        // Create staging environment.yaml
        await writeFile(
            join(stagingDir, ENVIRONMENT_YAML),
            createEnvironmentYaml({
                environment: "staging",
                aws_account_id: AWS_ACCOUNT_ID,
                aws_region: US_EAST_1,
                domains: {
                    "staging.example.com": {
                        zone_id: "Z2222222222222",
                        record_manager_role_arn: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/StagingDNS`
                    }
                }
            })
        );
        
        await writeFile(
            join(stagingDir, REGION_YAML),
            yaml.stringify({ region: US_EAST_1 })
        );
        
        // Mock isEnvironmentDeployed to return true for production, false for staging
        isEnvironmentDeployedMock.mockImplementation((async (inputs: { context: PanfactumContext; environment: string }) => {
            return inputs.environment === "production";
        }));
        
        const context = createMockContext(environmentsDir);
        const result = await getDomains({ context });
        
        const normalized = normalizeSnapshot(result);
        expect(normalized).toMatchInlineSnapshot(`
            {
              "example.com": {
                "domain": "example.com",
                "env": {
                  "deployed": true,
                  "name": "production",
                  "path": "<temp-dir>/environments/production",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/ProdDNS",
                "zoneId": "Z1111111111111",
              },
              "staging.example.com": {
                "domain": "staging.example.com",
                "env": {
                  "deployed": false,
                  "name": "staging",
                  "path": "<temp-dir>/environments/staging",
                },
                "recordManagerRoleARN": "arn:aws:iam::123456789012:role/StagingDNS",
                "zoneId": "Z2222222222222",
              },
            }
        `);
        
        // Verify that isEnvironmentDeployed was called with correct arguments
        expect(isEnvironmentDeployedMock).toHaveBeenCalledWith({
            context: expect.any(Object),
            environment: "production"
        });
        expect(isEnvironmentDeployedMock).toHaveBeenCalledWith({
            context: expect.any(Object),
            environment: "staging"
        });
    } finally {
        // Reset mock to default behavior
        isEnvironmentDeployedMock.mockImplementation((_inputs: { context: PanfactumContext; environment: string }) => Promise.resolve(false));
        await rm(testDir, { recursive: true, force: true });
    }
  });
});