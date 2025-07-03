// Tests for upsertPFYAMLFile utility
// Tests Panfactum-specific .pf.yaml file upserting functionality

import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { parse } from "yaml";
import { writeFile } from "@/util/fs/writeFile";
import { createTestDir } from "@/util/test/createTestDir";
import { upsertPFYAMLFile } from "./upsertPFYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Mock context for testing
 */
const mockContext: PanfactumContext = {
  logger: {
    debug: () => { },
  },
  devshellConfig: {
    environments_dir: "",
  },
} as unknown as PanfactumContext;

describe("upsertPFYAMLFile", () => {
  test("creates new .pf.yaml file when it doesn't exist", async () => {
    const { path: testDir } = await createTestDir({ functionName: "upsertPFYAMLFile" });
    try {
      // Set up environments directory structure
      const environsDir = join(testDir, "environments");
      await mkdir(join(environsDir, "dev", "us-east-1", "my-module"), { recursive: true });

      const testContext = {
        ...mockContext,
        devshellConfig: {
          ...mockContext.devshellConfig,
          environments_dir: environsDir,
        },
      };

      const updates = {
        version: "1.0.0",
        enabled: true,
        tags: ["test", "new"],
      };

      await upsertPFYAMLFile({
        context: testContext,
        environment: "dev",
        region: "us-east-1",
        module: "my-module",
        updates,
      });

      const filePath = join(environsDir, "dev", "us-east-1", "my-module", ".pf.yaml");
      const content = await Bun.file(filePath).text();
      const parsed = parse(content);

      expect(parsed).toMatchInlineSnapshot(`
{
  "enabled": true,
  "tags": [
    "test",
    "new",
  ],
  "version": "1.0.0",
}
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("updates existing .pf.yaml file by merging values", async () => {
    const { path: testDir } = await createTestDir({ functionName: "upsertPFYAMLFile" });
    try {
      // Set up environments directory structure
      const environsDir = join(testDir, "environments");
      const moduleDir = join(environsDir, "prod", "eu-west-1", "api");
      await mkdir(moduleDir, { recursive: true });

      const testContext = {
        ...mockContext,
        devshellConfig: {
          ...mockContext.devshellConfig,
          environments_dir: environsDir,
        },
      };

      // Create existing file
      const existingContent = `version: "0.9.0"
enabled: false
tags:
  - existing
  - old
config:
  timeout: 30`;

      await writeFile({
        context: testContext,
        filePath: join(moduleDir, ".pf.yaml"),
        contents: existingContent,
      });

      // Update with new values
      const updates = {
        version: "1.1.0",
        enabled: true,
        new_field: "new value",
      };

      await upsertPFYAMLFile({
        context: testContext,
        environment: "prod",
        region: "eu-west-1",
        module: "api",
        updates,
      });

      const filePath = join(moduleDir, ".pf.yaml");
      const content = await Bun.file(filePath).text();
      const parsed = parse(content);

      expect(parsed).toMatchInlineSnapshot(`
{
  "config": {
    "timeout": 30,
  },
  "enabled": true,
  "new_field": "new value",
  "tags": [
    "existing",
    "old",
  ],
  "version": "1.1.0",
}
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles realModuleName parameter", async () => {
    const { path: testDir } = await createTestDir({ functionName: "upsertPFYAMLFile" });
    try {
      // Set up environments directory structure
      const environsDir = join(testDir, "environments");
      const moduleDir = join(environsDir, "staging", "ap-south-1", "display-name");
      await mkdir(moduleDir, { recursive: true });

      const testContext = {
        ...mockContext,
        devshellConfig: {
          ...mockContext.devshellConfig,
          environments_dir: environsDir,
        },
      };

      // Create existing file first
      await writeFile({
        context: testContext,
        filePath: join(moduleDir, ".pf.yaml"),
        contents: "existing_field: value\n",
      });

      const updates = {
        module_type: "service",
        port: 8080,
      };

      await upsertPFYAMLFile({
        context: testContext,
        environment: "staging",
        region: "ap-south-1",
        module: "display-name",
        realModuleName: "actual-module-name",
        updates,
      });

      // File is created in module directory, but contains realModuleName in content
      const filePath = join(moduleDir, ".pf.yaml");
      const content = await Bun.file(filePath).text();
      const parsed = parse(content);

      expect(parsed).toMatchInlineSnapshot(`
{
  "existing_field": "value",
  "module": "actual-module-name",
  "module_type": "service",
  "port": 8080,
}
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("preserves nested object structures during merge", async () => {
    const { path: testDir } = await createTestDir({ functionName: "upsertPFYAMLFile" });
    try {
      // Set up environments directory structure
      const environsDir = join(testDir, "environments");
      const moduleDir = join(environsDir, "test", "us-west-2", "database");
      await mkdir(moduleDir, { recursive: true });

      const testContext = {
        ...mockContext,
        devshellConfig: {
          ...mockContext.devshellConfig,
          environments_dir: environsDir,
        },
      };

      // Create existing file with nested structure
      const existingContent = `database:
  host: localhost
  port: 5432
  credentials:
    username: admin
    database: mydb
settings:
  backup: true
  replicas: 2`;

      await writeFile({
        context: testContext,
        filePath: join(moduleDir, ".pf.yaml"),
        contents: existingContent,
      });

      // Update with partial nested values
      const updates = {
        database: {
          host: "prod-db.example.com",
          ssl: true,
        },
        settings: {
          replicas: 3,
        },
        monitoring: {
          enabled: true,
        },
      };

      await upsertPFYAMLFile({
        context: testContext,
        environment: "test",
        region: "us-west-2",
        module: "database",
        updates,
      });

      const filePath = join(moduleDir, ".pf.yaml");
      const content = await Bun.file(filePath).text();
      const parsed = parse(content);

      expect(parsed).toMatchInlineSnapshot(`
{
  "database": {
    "host": "prod-db.example.com",
    "ssl": true,
  },
  "monitoring": {
    "enabled": true,
  },
  "settings": {
    "replicas": 3,
  },
}
`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handles empty updates object", async () => {
    const { path: testDir } = await createTestDir({ functionName: "upsertPFYAMLFile" });
    try {
      // Set up environments directory structure
      const environsDir = join(testDir, "environments");
      await mkdir(join(environsDir, "qa", "sa-east-1", "empty-test"), { recursive: true });

      const testContext = {
        ...mockContext,
        devshellConfig: {
          ...mockContext.devshellConfig,
          environments_dir: environsDir,
        },
      };

      await upsertPFYAMLFile({
        context: testContext,
        environment: "qa",
        region: "sa-east-1",
        module: "empty-test",
        updates: {},
      });

      const filePath = join(environsDir, "qa", "sa-east-1", "empty-test", ".pf.yaml");
      const content = await Bun.file(filePath).text();
      const parsed = parse(content);

      expect(parsed).toMatchInlineSnapshot(`{}`);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});