// Tests for addAWSProfileFromStaticCreds utility function
// Verifies AWS profile creation and management functionality

import { rm, mkdir, writeFile as nodeWriteFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { parse } from "ini";
import { CLIError } from "@/util/error/error";
import * as writeFileModule from "@/util/fs/writeFile";
import { createTestDir } from "@/util/test/createTestDir";
import { addAWSProfileFromStaticCreds } from "./addAWSProfileFromStaticCreds";
import type { PanfactumContext } from "@/util/context/context";

let testDir: string;
let awsDir: string;
let configFilePath: string;
let credentialsFilePath: string;
let writeFileMock: ReturnType<typeof spyOn<typeof writeFileModule, "writeFile">>;

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

const testCredentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
};

describe("addAWSProfileFromStaticCreds", () => {
  beforeEach(async () => {
    // Create test directory structure
    const result = await createTestDir({ functionName: "addAWSProfileFromStaticCreds" });
    testDir = result.path;
    awsDir = join(testDir, ".aws");
    configFilePath = join(awsDir, "config");
    credentialsFilePath = join(awsDir, "credentials");

    // Update mock context with test directory
    mockContext.devshellConfig.aws_dir = awsDir;

    // Create AWS directory
    await mkdir(awsDir, { recursive: true });

    // Create spy for writeFile
    writeFileMock = spyOn(writeFileModule, "writeFile");
    writeFileMock.mockImplementation(async ({ filePath, contents }) => {
      await nodeWriteFile(filePath, contents, "utf8");
    });
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }

    // Restore mocks
    mock.restore();
  });

  test("creates new AWS config and credentials files when they don't exist", async () => {
    await addAWSProfileFromStaticCreds({
      context: mockContext,
      creds: testCredentials,
      profile: "test-profile"
    });

    // Verify writeFile was called twice (config and credentials)
    expect(writeFileMock).toHaveBeenCalledTimes(2);

    // Read and verify config file
    const configContent = await Bun.file(configFilePath).text();
    const configData = parse(configContent);

    expect(configData).toMatchInlineSnapshot(`
      {
        "profile test-profile": {
          "output": "text",
          "region": "us-east-1",
        },
      }
    `);

    // Read and verify credentials file
    const credentialsContent = await Bun.file(credentialsFilePath).text();
    const credentialsData = parse(credentialsContent);

    expect(credentialsData).toMatchInlineSnapshot(`
      {
        "test-profile": {
          "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
          "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        },
      }
    `);
  });

  test("updates existing AWS config file with new profile", async () => {
    // Create existing config file
    const existingConfig = `[profile existing-profile]
output = json
region = us-west-2`;
    await nodeWriteFile(configFilePath, existingConfig, "utf8");

    await addAWSProfileFromStaticCreds({
      context: mockContext,
      creds: testCredentials,
      profile: "new-profile"
    });

    // Read and verify config file contains both profiles
    const configContent = await Bun.file(configFilePath).text();
    const configData = parse(configContent);

    expect(configData).toMatchInlineSnapshot(`
      {
        "profile existing-profile": {
          "output": "json",
          "region": "us-west-2",
        },
        "profile new-profile": {
          "output": "text",
          "region": "us-east-1",
        },
      }
    `);
  });

  test("updates existing AWS credentials file with new profile", async () => {
    // Create existing credentials file
    const existingCredentials = `[existing-profile]
aws_access_key_id = EXISTING_ACCESS_KEY
aws_secret_access_key = existing_secret_key`;
    await nodeWriteFile(credentialsFilePath, existingCredentials, "utf8");

    await addAWSProfileFromStaticCreds({
      context: mockContext,
      creds: testCredentials,
      profile: "new-profile"
    });

    // Read and verify credentials file contains both profiles
    const credentialsContent = await Bun.file(credentialsFilePath).text();
    const credentialsData = parse(credentialsContent);

    expect(credentialsData).toMatchInlineSnapshot(`
      {
        "existing-profile": {
          "aws_access_key_id": "EXISTING_ACCESS_KEY",
          "aws_secret_access_key": "existing_secret_key",
        },
        "new-profile": {
          "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
          "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        },
      }
    `);
  });

  test("overwrites existing profile with same name", async () => {
    // Create existing files with the same profile name
    const existingConfig = `[profile test-profile]
output = json
region = us-west-2`;
    const existingCredentials = `[test-profile]
aws_access_key_id = OLD_ACCESS_KEY
aws_secret_access_key = old_secret_key`;

    await nodeWriteFile(configFilePath, existingConfig, "utf8");
    await nodeWriteFile(credentialsFilePath, existingCredentials, "utf8");

    await addAWSProfileFromStaticCreds({
      context: mockContext,
      creds: testCredentials,
      profile: "test-profile"
    });

    // Verify the profile was overwritten with new values
    const configContent = await Bun.file(configFilePath).text();
    const configData = parse(configContent);

    expect(configData["profile test-profile"]).toMatchInlineSnapshot(`
      {
        "output": "text",
        "region": "us-east-1",
      }
    `);

    const credentialsContent = await Bun.file(credentialsFilePath).text();
    const credentialsData = parse(credentialsContent);

    expect(credentialsData["test-profile"]).toMatchInlineSnapshot(`
      {
        "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      }
    `);
  });

  test("throws CLIError when unable to read existing config file", async () => {
    // Create a config file with invalid permissions or corrupt content
    await nodeWriteFile(configFilePath, "invalid ini content [[[", "utf8");

    // Mock Bun.file to throw an error
    const originalBunFile = globalThis.Bun.file;
    globalThis.Bun.file = (() => {
      throw new Error("Permission denied");
    }) as typeof globalThis.Bun.file;

    try {
      await expect(
        addAWSProfileFromStaticCreds({
          context: mockContext,
          creds: testCredentials,
          profile: "test-profile"
        })
      ).rejects.toThrow(CLIError);
    } finally {
      // Restore Bun.file
      globalThis.Bun.file = originalBunFile;
    }
  });

  test("throws CLIError when unable to read existing credentials file", async () => {
    // Create a credentials file and mock read failure
    await nodeWriteFile(credentialsFilePath, "valid content", "utf8");

    let callCount = 0;
    const originalBunFile = globalThis.Bun.file;
    globalThis.Bun.file = ((path: Parameters<typeof originalBunFile>[0]) => {
      callCount++;
      if (callCount === 2 && String(path).includes("credentials")) {
        throw new Error("Permission denied");
      }
      return originalBunFile(path);
    }) as typeof globalThis.Bun.file;

    try {
      await expect(
        addAWSProfileFromStaticCreds({
          context: mockContext,
          creds: testCredentials,
          profile: "test-profile"
        })
      ).rejects.toThrow(CLIError);
    } finally {
      // Restore Bun.file
      globalThis.Bun.file = originalBunFile;
    }
  });

  test("throws CLIError when unable to write config file", async () => {
    // Mock writeFile to fail for config file
    writeFileMock.mockImplementation(async ({ filePath }) => {
      if (filePath.includes("config")) {
        throw new Error("Permission denied");
      }
      await nodeWriteFile(filePath, "content", "utf8");
    });

    await expect(
      addAWSProfileFromStaticCreds({
        context: mockContext,
        creds: testCredentials,
        profile: "test-profile"
      })
    ).rejects.toThrow(CLIError);
  });

  test("throws CLIError when unable to write credentials file", async () => {
    // Mock writeFile to fail for credentials file
    writeFileMock.mockImplementation(async ({ filePath }) => {
      if (filePath.includes("credentials")) {
        throw new Error("Permission denied");
      }
      await nodeWriteFile(filePath, "content", "utf8");
    });

    await expect(
      addAWSProfileFromStaticCreds({
        context: mockContext,
        creds: testCredentials,
        profile: "test-profile"
      })
    ).rejects.toThrow(CLIError);
  });

  test("handles profiles with special characters in name", async () => {
    const specialProfileName = "dev-environment_123";

    await addAWSProfileFromStaticCreds({
      context: mockContext,
      creds: testCredentials,
      profile: specialProfileName
    });

    const configContent = await Bun.file(configFilePath).text();
    const configData = parse(configContent);

    expect(configData[`profile ${specialProfileName}`]).toBeDefined();
    expect((configData[`profile ${specialProfileName}`] as { region: string }).region).toBe("us-east-1");
  });

  test("sets correct default values for new profiles", async () => {
    await addAWSProfileFromStaticCreds({
      context: mockContext,
      creds: testCredentials,
      profile: "test-profile"
    });

    const configContent = await Bun.file(configFilePath).text();
    const configData = parse(configContent);

    // Verify default values are set correctly
    const profileData = configData["profile test-profile"] as { output: string; region: string };
    expect(profileData.output).toBe("text");
    expect(profileData.region).toBe("us-east-1");
  });

  test("preserves existing profiles when adding new ones", async () => {
    // Add first profile
    await addAWSProfileFromStaticCreds({
      context: mockContext,
      creds: testCredentials,
      profile: "profile-1"
    });

    // Add second profile with different credentials
    const secondCredentials = {
      accessKeyId: "AKIAI2345678901234567",
      secretAccessKey: "differentSecretKey123456789"
    };

    await addAWSProfileFromStaticCreds({
      context: mockContext,
      creds: secondCredentials,
      profile: "profile-2"
    });

    // Verify both profiles exist
    const configContent = await Bun.file(configFilePath).text();
    const configData = parse(configContent);

    expect(configData["profile profile-1"]).toBeDefined();
    expect(configData["profile profile-2"]).toBeDefined();

    const credentialsContent = await Bun.file(credentialsFilePath).text();
    const credentialsData = parse(credentialsContent);

    const profile1Data = credentialsData["profile-1"] as { aws_access_key_id: string };
    const profile2Data = credentialsData["profile-2"] as { aws_access_key_id: string };
    expect(profile1Data.aws_access_key_id).toBe(testCredentials.accessKeyId);
    expect(profile2Data.aws_access_key_id).toBe(secondCredentials.accessKeyId);
  });
});