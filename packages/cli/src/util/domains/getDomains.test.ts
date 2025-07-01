import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { test, expect, mock } from "bun:test";
import yaml from "yaml";
import { CLIError } from "@/util/error/error";
import { getDomains } from "./getDomains";
import type { PanfactumContext } from "@/util/context/context";

// Constants to avoid duplication
const US_EAST_1 = "us-east-1";
const AWS_ACCOUNT_ID = "123456789012";
const ENVIRONMENT_YAML = "environment.yaml";
const GLOBAL_YAML = "global.yaml";
const REGION_YAML = "region.yaml";

// Mock isEnvironmentDeployed to avoid dependency on complex config loading
const isEnvironmentDeployedMock = mock((_inputs: { context: PanfactumContext; environment: string }) => Promise.resolve(false));
mock.module("@/util/config/isEnvironmentDeployed", () => ({
    isEnvironmentDeployed: isEnvironmentDeployedMock
}));

// Mock getPanfactumConfig to read from our test YAML files
mock.module("@/util/config/getPanfactumConfig", () => ({
    getPanfactumConfig: mock(async ({ directory }: { directory: string }) => {
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
    })
}));

// Helper to create a mock context
const createMockContext = (environmentsDir: string): PanfactumContext => ({
    logger: {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {})
    },
    repoVariables: {
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

test("returns empty object when no environment.yaml files exist", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        expect(result).toEqual({});
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("extracts domains from single environment", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        expect(Object.keys(result)).toHaveLength(2);
        expect(result["example.com"]).toEqual({
            domain: "example.com",
            zoneId: "Z1234567890ABC",
            recordManagerRoleARN: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/DNSManager`,
            env: {
                name: "production",
                path: prodDir,
                deployed: false // Will be false as isEnvironmentDeployed will fail in test
            }
        });
        expect(result["api.example.com"]).toEqual({
            domain: "api.example.com",
            zoneId: "Z0987654321XYZ",
            recordManagerRoleARN: `arn:aws:iam::${AWS_ACCOUNT_ID}:role/DNSManager`,
            env: {
                name: "production",
                path: prodDir,
                deployed: false
            }
        });
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("merges domains from multiple environments", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        expect(Object.keys(result)).toHaveLength(2);
        expect(result["example.com"]?.env.name).toBe("production");
        expect(result["staging.example.com"]?.env.name).toBe("staging");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles environment.yaml without domains", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        expect(result).toEqual({});
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("throws CLIError when environment name is missing", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        expect(Object.keys(result)).toHaveLength(1);
        expect(result["nested.example.com"]).toBeDefined();
        expect(result["nested.example.com"]?.env.name).toBe("nested-prod");
        expect(result["nested.example.com"]?.env.path).toBe(nestedDir);
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles domain with special characters in config", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        expect(result["my-special-domain.example.com"]).toBeDefined();
        expect(result["my-special-domain.example.com"]?.domain).toBe("my-special-domain.example.com");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles multiple domains in same environment", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        expect(Object.keys(result)).toHaveLength(3);
        expect(result["domain1.com"]).toBeDefined();
        expect(result["domain2.com"]).toBeDefined();
        expect(result["subdomain.domain1.com"]).toBeDefined();
        
        // All should share same environment
        expect(result["domain1.com"]?.env.name).toBe("multi-domain");
        expect(result["domain2.com"]?.env.name).toBe("multi-domain");
        expect(result["subdomain.domain1.com"]?.env.name).toBe("multi-domain");
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("ignores non-environment.yaml files", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        // Should only find the one domain from environment.yaml
        expect(Object.keys(result)).toHaveLength(1);
        expect(result["test.com"]).toBeDefined();
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("handles empty domains object in environment.yaml", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        expect(result).toEqual({});
    } finally {
        await rm(testDir, { recursive: true, force: true });
    }
});

test("updates deployed status based on isEnvironmentDeployed", async () => {
    const testDir = join(tmpdir(), `getDomains-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
        
        // Verify that production domain has deployed: true
        expect(result["example.com"]?.env.deployed).toBe(true);
        
        // Verify that staging domain has deployed: false
        expect(result["staging.example.com"]?.env.deployed).toBe(false);
        
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