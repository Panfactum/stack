// Tests for devshell configuration loading and validation
// Covers main config file reading, user overrides, schema validation, and path resolution

import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";
import { getDevshellConfig } from "./getDevshellConfig";
import * as getRootModule from "./getRoot";

describe("getDevshellConfig", () => {
  let testDir: string;
  let getRootMock: ReturnType<typeof spyOn<typeof getRootModule, "getRoot">>;

  // Test constants
  const TEST_REPO_NAME = "test-repo";
  const TEST_REPO_URL = "git::https://github.com/example/test-repo.git";
  const CONFIG_FILE_NAME = "panfactum.yaml";
  const USER_CONFIG_FILE_NAME = "panfactum.user.yaml";
  const TEST_PATH = "/some/path";

  beforeEach(async () => {
    const result = await createTestDir({ functionName: "getDevshellConfig" });
    testDir = result.path;
    
    // Mock getRoot to return our test directory
    getRootMock = spyOn(getRootModule, "getRoot");
    getRootMock.mockResolvedValue(testDir);
  });

  afterEach(async () => {
    mock.restore();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("loads and validates minimal valid configuration", async () => {
    const configContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configContent);

    const config = await getDevshellConfig(TEST_PATH);

    expect(config).toMatchInlineSnapshot(`
      {
        "aws_dir": "${testDir}/.aws",
        "buildkit_dir": "${testDir}/.buildkit",
        "environments_dir": "${testDir}/environments",
        "iac_dir": "${testDir}/infrastructure",
        "iac_relative_dir": "infrastructure",
        "kube_dir": "${testDir}/.kube",
        "nats_dir": "${testDir}/.nats",
        "repo_name": "${TEST_REPO_NAME}",
        "repo_primary_branch": "main",
        "repo_root": "${testDir}",
        "repo_url": "${TEST_REPO_URL}",
        "ssh_dir": "${testDir}/.ssh",
      }
    `);
  });

  test("loads configuration with custom directory paths", async () => {
    const configContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
environments_dir: "custom-envs"
iac_dir: "custom-iac"
aws_dir: "custom-aws"
kube_dir: "custom-kube"
ssh_dir: "custom-ssh"
buildkit_dir: "custom-buildkit"
nats_dir: "custom-nats"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configContent);

    const config = await getDevshellConfig(TEST_PATH);

    expect(config.environments_dir).toBe(join(testDir, "custom-envs"));
    expect(config.iac_dir).toBe(join(testDir, "custom-iac"));
    expect(config.iac_relative_dir).toBe("custom-iac");
    expect(config.aws_dir).toBe(join(testDir, "custom-aws"));
    expect(config.kube_dir).toBe(join(testDir, "custom-kube"));
    expect(config.ssh_dir).toBe(join(testDir, "custom-ssh"));
    expect(config.buildkit_dir).toBe(join(testDir, "custom-buildkit"));
    expect(config.nats_dir).toBe(join(testDir, "custom-nats"));
  });

  test("loads configuration with optional analytics fields", async () => {
    const configContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
installation_id: "550e8400-e29b-41d4-a716-446655440000"
user_id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configContent);

    const config = await getDevshellConfig(TEST_PATH);

    expect(config.installation_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(config.user_id).toBe("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  });

  test("merges user configuration overrides", async () => {
    const mainConfigContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
environments_dir: "environments"
iac_dir: "infrastructure"
`;
    
    const userConfigContent = `
environments_dir: "my-custom-envs"
aws_dir: "my-aws"
`;

    await writeFile(join(testDir, CONFIG_FILE_NAME), mainConfigContent);
    await writeFile(join(testDir, USER_CONFIG_FILE_NAME), userConfigContent);

    const config = await getDevshellConfig(TEST_PATH);

    expect(config.environments_dir).toBe(join(testDir, "my-custom-envs"));
    expect(config.aws_dir).toBe(join(testDir, "my-aws"));
    expect(config.iac_dir).toBe(join(testDir, "infrastructure")); // Not overridden
  });

  test("handles different valid repo URL formats", async () => {
    const testCases = [
      "git::https://github.com/example/repo.git",
      "github.com/example/repo",
      "bitbucket.org/example/repo"
    ];

    for (const repoUrl of testCases) {
      const configContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${repoUrl}"
`;
      await writeFile(join(testDir, CONFIG_FILE_NAME), configContent);

      const config = await getDevshellConfig(TEST_PATH);
      expect(config.repo_url).toBe(repoUrl);
    }
  });

  test("throws CLIError when main config file does not exist", async () => {
    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(CLIError);
    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow("Devshell configuration file does not exist");
  });

  test("throws CLIError when main config file cannot be read", async () => {
    // Create an inaccessible file (this will be simulated via file system error)
    await writeFile(join(testDir, CONFIG_FILE_NAME), "content");
    
    // Mock Bun.file to simulate read error
    const originalBunFile = Bun.file;
    Bun.file = (_path: string | globalThis.URL | ArrayBufferLike | Uint8Array | number, _options?: globalThis.BlobPropertyBag) => {
      const mockFile = {
        exists: () => Promise.resolve(true),
        text: () => Promise.reject(new Error("Permission denied"))
      };
      return mockFile as unknown as ReturnType<typeof originalBunFile>;
    };

    try {
      await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(CLIError);
      await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow("Failed to read devshell configuration file");
    } finally {
      Bun.file = originalBunFile;
    }
  });

  test("throws CLIError when main config has invalid YAML syntax", async () => {
    const invalidYaml = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: main
repo_url: git::https://github.com/example/test-repo.git
  invalid_indent: bad
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), invalidYaml);

    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(CLIError);
    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow("Invalid YAML syntax in devshell configuration file");
  });

  test("throws CLIError when user config file cannot be read", async () => {
    const mainConfigContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), mainConfigContent);
    await writeFile(join(testDir, USER_CONFIG_FILE_NAME), "content");

    // Mock Bun.file to simulate read error for user config only
    const originalBunFile = Bun.file;
    Bun.file = (path: string | globalThis.URL | ArrayBufferLike | Uint8Array | number, options?: globalThis.BlobPropertyBag) => {
      if (typeof path === 'string' && path.includes(USER_CONFIG_FILE_NAME)) {
        const mockFile = {
          exists: () => Promise.resolve(true),
          text: () => Promise.reject(new Error("Permission denied"))
        };
        return mockFile as unknown as ReturnType<typeof originalBunFile>;
      }
      if (typeof path === 'string' || path instanceof globalThis.URL) {
        return originalBunFile(path, options);
      } else if (path instanceof ArrayBuffer || path instanceof Uint8Array || ArrayBuffer.isView(path)) {
        return originalBunFile(path as ArrayBufferLike | Uint8Array, options);
      } else if (typeof path === 'number') {
        return originalBunFile(path, options);
      }
      return originalBunFile(path as never, options);
    };

    try {
      await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(CLIError);
      await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow("Failed to read user configuration file");
    } finally {
      Bun.file = originalBunFile;
    }
  });

  test("throws CLIError when user config has invalid YAML syntax", async () => {
    const mainConfigContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
`;
    
    const invalidUserYaml = `
environments_dir: custom-envs
  invalid_indent: bad
`;

    await writeFile(join(testDir, CONFIG_FILE_NAME), mainConfigContent);
    await writeFile(join(testDir, USER_CONFIG_FILE_NAME), invalidUserYaml);

    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(CLIError);
    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow("Invalid YAML syntax in user configuration file");
  });

  test("throws PanfactumZodError when required fields are missing", async () => {
    const incompleteConfig = `
repo_name: "${TEST_REPO_NAME}"
# Missing repo_primary_branch and repo_url
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), incompleteConfig);

    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(PanfactumZodError);
    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow("Invalid configuration in devshell config file");
  });

  test("throws PanfactumZodError when repo_url format is invalid", async () => {
    const configWithInvalidUrl = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "http://example.com/repo.git"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configWithInvalidUrl);

    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(PanfactumZodError);
  });

  test("throws PanfactumZodError when directory paths have leading slash", async () => {
    const configWithInvalidPath = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
iac_dir: "/absolute/path"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configWithInvalidPath);

    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(PanfactumZodError);
  });

  test("throws PanfactumZodError when directory paths have trailing slash", async () => {
    const configWithInvalidPath = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
environments_dir: "envs/"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configWithInvalidPath);

    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(PanfactumZodError);
  });

  test("throws PanfactumZodError when installation_id is not a valid UUID", async () => {
    const configWithInvalidUuid = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
installation_id: "not-a-uuid"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configWithInvalidUuid);

    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(PanfactumZodError);
  });

  test("throws PanfactumZodError when user_id is not a valid UUID", async () => {
    const configWithInvalidUuid = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
user_id: "invalid-uuid"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configWithInvalidUuid);

    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(PanfactumZodError);
  });

  test("handles non-object values in main config gracefully", async () => {
    await writeFile(join(testDir, CONFIG_FILE_NAME), "null");

    await expect(getDevshellConfig(TEST_PATH)).rejects.toThrow(PanfactumZodError);
  });

  test("handles non-object values in user config gracefully", async () => {
    const mainConfigContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
`;
    
    await writeFile(join(testDir, CONFIG_FILE_NAME), mainConfigContent);
    await writeFile(join(testDir, USER_CONFIG_FILE_NAME), "null");

    // Should still work - non-object user config is ignored
    const config = await getDevshellConfig(TEST_PATH);
    expect(config.repo_name).toBe("test-repo");
  });

  test("passes correct working directory to getRoot", async () => {
    const configContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configContent);

    const testCwd = "/some/specific/path";
    await getDevshellConfig(testCwd);

    expect(getRootMock).toHaveBeenCalledWith(testCwd);
  });

  test("preserves original iac_dir as iac_relative_dir", async () => {
    const configContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
iac_dir: "custom/infrastructure/path"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configContent);

    const config = await getDevshellConfig(TEST_PATH);

    expect(config.iac_relative_dir).toBe("custom/infrastructure/path");
    expect(config.iac_dir).toBe(join(testDir, "custom/infrastructure/path"));
  });

  test("sets repo_root to the value returned by getRoot", async () => {
    const configContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
`;
    
    // Create a custom root directory and write config there
    const customRoot = join(testDir, "custom-root");
    await mkdir(customRoot, { recursive: true });
    await writeFile(join(customRoot, CONFIG_FILE_NAME), configContent);

    getRootMock.mockResolvedValueOnce(customRoot);

    const config = await getDevshellConfig(TEST_PATH);

    expect(config.repo_root).toBe(customRoot);
  });

  test("resolves all directory paths relative to repo root", async () => {
    const configContent = `
repo_name: "${TEST_REPO_NAME}"
repo_primary_branch: "main"
repo_url: "${TEST_REPO_URL}"
environments_dir: "nested/envs"
iac_dir: "nested/iac"
aws_dir: "config/aws"
kube_dir: "config/kube"
ssh_dir: "config/ssh"
buildkit_dir: "config/buildkit"
nats_dir: "config/nats"
`;
    await writeFile(join(testDir, CONFIG_FILE_NAME), configContent);

    const config = await getDevshellConfig(TEST_PATH);

    expect(config.environments_dir).toBe(join(testDir, "nested/envs"));
    expect(config.iac_dir).toBe(join(testDir, "nested/iac"));
    expect(config.aws_dir).toBe(join(testDir, "config/aws"));
    expect(config.kube_dir).toBe(join(testDir, "config/kube"));
    expect(config.ssh_dir).toBe(join(testDir, "config/ssh"));
    expect(config.buildkit_dir).toBe(join(testDir, "config/buildkit"));
    expect(config.nats_dir).toBe(join(testDir, "config/nats"));
  });
});