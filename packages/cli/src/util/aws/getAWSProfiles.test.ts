// Tests for getAWSProfiles utility function
// Verifies AWS profile extraction from config files

import { rm, mkdir, writeFile as nodeWriteFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { CLIError } from "@/util/error/error";
import * as fileExistsModule from "@/util/fs/fileExists";
import { createTestDir } from "@/util/test/createTestDir";
import { getAWSProfiles } from "./getAWSProfiles";
import type { PanfactumContext } from "@/util/context/context";

let testDir: string;
let awsDir: string;
let configFilePath: string;

const mockContext = {
  devshellConfig: {
    aws_dir: ""
  },
  logger: {
    info: () => { },
    error: () => { },
    warn: () => { }
  }
} as unknown as PanfactumContext;

describe("getAWSProfiles", () => {
  beforeEach(async () => {
    // Create test directory structure
    const result = await createTestDir({ functionName: "getAWSProfiles" });
    testDir = result.path;
    awsDir = join(testDir, ".aws");
    configFilePath = join(awsDir, "config");

    // Update mock context with test directory
    mockContext.devshellConfig.aws_dir = awsDir;

    // Create AWS directory
    await mkdir(awsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("returns empty array when config file does not exist", async () => {
    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toEqual([]);
  });

  test("throws error when config file does not exist and throwOnMissingConfig is true", async () => {
    await expect(
      getAWSProfiles(mockContext, { throwOnMissingConfig: true })
    ).rejects.toThrow(CLIError);

    try {
      await getAWSProfiles(mockContext, { throwOnMissingConfig: true });
    } catch (error) {
      expect(error).toBeInstanceOf(CLIError);
      expect((error as CLIError).message).toContain("Cannot get AWS profiles as AWS config file");
      expect((error as CLIError).message).toContain("does not exist");
    }
  });

  test("parses default profile correctly", async () => {
    const configContent = `[default]
region = us-east-1
output = json`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "default",
      ]
    `);
  });

  test("parses named profiles correctly", async () => {
    const configContent = `[profile dev]
region = us-west-2
output = json

[profile production]
region = us-east-1
output = table`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "dev",
        "production",
      ]
    `);
  });

  test("parses mix of default and named profiles", async () => {
    const configContent = `[default]
region = us-east-1
output = json

[profile staging]
region = us-west-1
output = table

[profile production]
region = us-east-1
output = json`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "default",
        "production",
        "staging",
      ]
    `);
  });

  test("handles profiles with spaces in names", async () => {
    const configContent = `[profile my dev profile]
region = us-west-2
output = json

[profile test environment]
region = us-east-1
output = table`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "my dev profile",
        "test environment",
      ]
    `);
  });

  test("handles profiles with special characters", async () => {
    const configContent = `[profile dev-123]
region = us-west-2
output = json

[profile test_env]
region = us-east-1
output = table

[profile prod.final]
region = us-east-1
output = json`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "dev-123",
        "prod.final",
        "test_env",
      ]
    `);
  });

  test("ignores non-profile sections", async () => {
    const configContent = `[default]
region = us-east-1
output = json

[sso-session admin]
sso_start_url = https://example.awsapps.com/start
sso_region = us-east-1

[profile dev]
region = us-west-2
output = json

[services]
ec2 =
  max_bandwidth = 100MB/s`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "default",
        "dev",
      ]
    `);
  });

  test("handles empty config file", async () => {
    await nodeWriteFile(configFilePath, "", "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toEqual([]);
  });

  test("handles config file with only comments and whitespace", async () => {
    const configContent = `# This is a comment
  
# Another comment

  # Whitespace and comments only
`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toEqual([]);
  });

  test("handles malformed profile sections gracefully", async () => {
    const configContent = `[default]
region = us-east-1
output = json

[profile valid-profile]
region = us-west-2
output = json

[invalid section
region = us-east-1

[profile another-valid]
region = us-west-1
output = table`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "another-valid",
        "default",
        "valid-profile",
      ]
    `);
  });

  test("handles duplicate profile names", async () => {
    const configContent = `[default]
region = us-east-1
output = json

[profile dev]
region = us-west-2
output = json

[default]
region = us-west-1
output = table

[profile dev]
region = us-east-2
output = text`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "default",
        "default",
        "dev",
        "dev",
      ]
    `);
  });

  test("handles profiles with inline settings", async () => {
    const configContent = `[default]
region = us-east-1
output = json

[profile dev]
region = us-west-2
output = json
role_arn = arn:aws:iam::123456789012:role/DevRole
source_profile = default

[profile prod]
region = us-east-1
output = table
sso_start_url = https://example.awsapps.com/start
sso_region = us-east-1
sso_account_id = 123456789012
sso_role_name = PowerUserAccess`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "default",
        "dev",
        "prod",
      ]
    `);
  });

  test("handles large config file with many profiles", async () => {
    const profileNames = [];
    let configContent = `[default]
region = us-east-1
output = json

`;

    // Generate 50 test profiles
    for (let i = 1; i <= 50; i++) {
      const profileName = `test-profile-${i.toString().padStart(2, '0')}`;
      profileNames.push(profileName);
      configContent += `[profile ${profileName}]
region = us-west-${(i % 4) + 1}
output = json

`;
    }

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toHaveLength(51); // 50 + default
    expect(profiles[0]).toBe("default");
    expect(profiles).toContain("test-profile-01");
    expect(profiles).toContain("test-profile-50");

    // Verify all profiles are sorted
    const sortedProfiles = [...profiles].sort();
    expect(profiles).toEqual(sortedProfiles);
  });

  test("throws CLIError when unable to read config file", async () => {
    // Create config file
    await nodeWriteFile(configFilePath, "[default]\nregion = us-east-1", "utf8");

    // Mock fileExists to return true but Bun.file to throw an error when reading
    const fileExistsMock = spyOn(fileExistsModule, "fileExists");
    fileExistsMock.mockResolvedValue(true);

    const originalBunFile = Bun.file;
    Bun.file = (_path: string | globalThis.URL | ArrayBufferLike | Uint8Array | number, _options?: globalThis.BlobPropertyBag) => {
      const mockFile = {
        text: async () => {
          throw new Error("Permission denied");
        }
      };
      return mockFile as unknown as ReturnType<typeof originalBunFile>;
    };

    try {
      await expect(
        getAWSProfiles(mockContext)
      ).rejects.toThrow(CLIError);

      try {
        await getAWSProfiles(mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).message).toContain("Failed to get AWS profiles from");
      }
    } finally {
      // Restore mocks
      Bun.file = originalBunFile;
      mock.restore();
    }
  });

  test("returns profiles in alphabetical order", async () => {
    const configContent = `[profile zebra]
region = us-west-2
output = json

[default]
region = us-east-1
output = json

[profile alpha]
region = us-west-1
output = table

[profile beta]
region = us-east-2
output = text`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "alpha",
        "beta",
        "default",
        "zebra",
      ]
    `);
  });

  test("handles UTF-8 encoded config file", async () => {
    const configContent = `[default]
region = us-east-1
output = json

[profile test-ñ]
region = us-west-2
output = json

[profile test-€]
region = us-west-1
output = table`;

    await nodeWriteFile(configFilePath, configContent, "utf8");

    const profiles = await getAWSProfiles(mockContext);

    expect(profiles).toMatchInlineSnapshot(`
      [
        "default",
        "test-ñ",
        "test-€",
      ]
    `);
  });
});