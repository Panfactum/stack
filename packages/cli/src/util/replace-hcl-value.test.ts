import fs from "fs";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, test } from "bun:test";
import { replaceHclValue } from "./replace-hcl-value";

describe("replaceHclValue", () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), "hcl-test-"));
    testFilePath = join(tempDir, "test.hcl");
  });

  afterEach(async () => {
    // Clean up temporary directory after tests
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should replace a string value", async () => {
    // Setup initial file content
    const initialContent = `
resource "aws_s3_bucket" "example" {
  name = "old-bucket-name"
  region = "us-west-2"
}
`;
    await Bun.write(testFilePath, initialContent);

    // Execute the function
    await replaceHclValue(testFilePath, "name", "new-bucket-name");

    // Verify the result
    const updatedContent = await Bun.file(testFilePath).text();
    expect(updatedContent).toContain('name = "new-bucket-name"');
    expect(updatedContent).not.toContain('name = "old-bucket-name"');
    expect(updatedContent).toContain('region = "us-west-2"'); // Other properties should remain unchanged

    // Clean up
    fs.unlinkSync(testFilePath);
  });

  it("should do nothing when key does not exist", async () => {
    // Setup initial file content
    const initialContent = `
resource "aws_s3_bucket" "example" {
  name = "test-bucket"
}
`;
    await Bun.write(testFilePath, initialContent);

    // Execute the function
    await replaceHclValue(testFilePath, "non_existent_key", "some-value");

    // Verify the result
    const updatedContent = await Bun.file(testFilePath).text();
    expect(updatedContent).toEqual(initialContent); // Content should remain unchanged

    // Clean up
    fs.unlinkSync(testFilePath);
  });

  it("should handle multiple occurrences of the same key", async () => {
    // Setup initial file content with multiple instances of the same key
    const initialContent = `
resource "aws_instance" "example1" {
  instance_type = "t2.micro"
}

resource "aws_instance" "example2" {
  instance_type = "t2.small"
}
`;
    await Bun.write(testFilePath, initialContent);

    // Execute the function
    await replaceHclValue(testFilePath, "instance_type", "t3.medium");

    // Verify the result
    const updatedContent = await Bun.file(testFilePath).text();
    const count = (updatedContent.match(/instance_type = "t3.medium"/g) || [])
      .length;
    expect(count).toBe(2); // Should replace all occurrences
    expect(updatedContent).not.toContain('instance_type = "t2.micro"');
    expect(updatedContent).not.toContain('instance_type = "t2.small"');

    // Clean up
    fs.unlinkSync(testFilePath);
  });

  test("replaces top-level key value", async () => {
    // Create test HCL file with a top-level key
    const initialContent = `
      key1 = "value1"
      key2 = "value2"
    `;
    await writeFile(testFilePath, initialContent);

    // Replace the value
    await replaceHclValue(testFilePath, "key1", "new-value");

    // Read the updated file
    const updatedContent = await readFile(testFilePath, "utf8");

    // Verify the value was replaced
    expect(updatedContent).toContain('key1 = "new-value"');
    expect(updatedContent).toContain('key2 = "value2"');
  });

  test("replaces nested key value within a block", async () => {
    // Create test HCL file with a nested key in a block
    const initialContent = `
      block1 = {
        nested_key1 = "value1"
        nested_key2 = "value2"
      }
    `;
    await writeFile(testFilePath, initialContent);

    // Replace the nested value
    await replaceHclValue(testFilePath, "block1.nested_key1", "new-value");

    // Read the updated file
    const updatedContent = await readFile(testFilePath, "utf8");

    // Verify the value was replaced
    expect(updatedContent).toContain('nested_key1 = "new-value"');
    expect(updatedContent).toContain('nested_key2 = "value2"');
  });

  test("replaces empty string values", async () => {
    // Create test HCL file with empty string values
    const initialContent = `
      inputs = {
        cluster_name = ""
        cluster_description = ""
      }
    `;
    await writeFile(testFilePath, initialContent);

    // Replace the empty values
    await replaceHclValue(testFilePath, "inputs.cluster_name", "test-cluster");
    await replaceHclValue(
      testFilePath,
      "inputs.cluster_description",
      "Test cluster description"
    );

    // Read the updated file
    const updatedContent = await readFile(testFilePath, "utf8");

    // Verify the values were replaced
    expect(updatedContent).toContain('cluster_name = "test-cluster"');
    expect(updatedContent).toContain(
      'cluster_description = "Test cluster description"'
    );
  });

  test("handles terragrunt.hcl format correctly", async () => {
    // Create test terragrunt.hcl file similar to the reference example
    const initialContent = `
      include "panfactum" {
        path   = find_in_parent_folders("panfactum.hcl")
        expose = true
      }

      terraform {
        source = include.panfactum.locals.pf_stack_source
      }

      inputs = {
        vpc_id     = dependency.aws_vpc.outputs.vpc_id
        cluster_name = ""
        cluster_description = ""
      }
    `;
    await writeFile(testFilePath, initialContent);

    // Replace the values
    await replaceHclValue(testFilePath, "inputs.cluster_name", "prod-cluster");
    await replaceHclValue(
      testFilePath,
      "inputs.cluster_description",
      "Production Kubernetes cluster"
    );

    // Read the updated file
    const updatedContent = await readFile(testFilePath, "utf8");

    // Verify the values were replaced
    expect(updatedContent).toContain('cluster_name = "prod-cluster"');
    expect(updatedContent).toContain(
      'cluster_description = "Production Kubernetes cluster"'
    );
    // Make sure other content is preserved
    expect(updatedContent).toContain(
      "vpc_id     = dependency.aws_vpc.outputs.vpc_id"
    );
  });
});
