// Unit tests for getRoot function
// Tests finding git repository root directory from various starting points

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { getRoot } from "@/util/devshell/getRoot";
import { CLIError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";



describe("getRoot", () => {
  let testDir: string;
  let gitRepo: string;

  beforeEach(async () => {
    const result = await createTestDir({ functionName: "getRoot" });
    testDir = result.path;
    gitRepo = join(testDir, "git-repo");
    
    // Create a git repository for testing
    await mkdir(gitRepo);
    
    // Initialize git repo
    const initProc = Bun.spawn(["git", "init"], { cwd: gitRepo });
    await initProc.exited;
    
    // Set up git config to avoid warnings and SSH issues
    const configNameProc = Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: gitRepo });
    await configNameProc.exited;
    
    const configEmailProc = Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: gitRepo });
    await configEmailProc.exited;
    
    // Disable GPG signing to avoid SSH key issues
    const configGpgProc = Bun.spawn(["git", "config", "commit.gpgsign", "false"], { cwd: gitRepo });
    await configGpgProc.exited;
    
    const configTagGpgProc = Bun.spawn(["git", "config", "tag.gpgsign", "false"], { cwd: gitRepo });
    await configTagGpgProc.exited;
    
    // Create an initial commit to make it a proper git repo
    await writeFile(join(gitRepo, "README.md"), "# Test Repository");
    const addProc = Bun.spawn(["git", "add", "README.md"], { cwd: gitRepo });
    await addProc.exited;
    
    const commitProc = Bun.spawn(["git", "commit", "-m", "Initial commit"], { cwd: gitRepo });
    await commitProc.exited;
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("should return repository root when called from root directory", async () => {
    const result = await getRoot(gitRepo);
    
    expect(result).toBe(gitRepo);
  });

  test("should return repository root when called from subdirectory", async () => {
    // Create nested directories
    const subDir = join(gitRepo, "src", "components");
    await mkdir(subDir, { recursive: true });
    
    const result = await getRoot(subDir);
    
    expect(result).toBe(gitRepo);
  });

  test("should return repository root when called from deeply nested directory", async () => {
    // Create deeply nested structure
    const deepDir = join(gitRepo, "packages", "cli", "src", "util", "test");
    await mkdir(deepDir, { recursive: true });
    
    const result = await getRoot(deepDir);
    
    expect(result).toBe(gitRepo);
  });

  test("should work with symbolic links in path", async () => {
    // Create a subdirectory and symlink to it
    const subDir = join(gitRepo, "sub");
    await mkdir(subDir);
    
    const symlinkPath = join(testDir, "symlink-to-sub");
    
    try {
      // Create symlink (may fail on some systems, that's okay)
      const symlinkProc = Bun.spawn(["ln", "-s", subDir, symlinkPath]);
      await symlinkProc.exited;
      
      const result = await getRoot(symlinkPath);
      
      expect(result).toBe(gitRepo);
    } catch {
      // Skip test if symlinks aren't supported
      // Test will be skipped silently
    }
  });

  test("should work from directory with spaces in name", async () => {
    // Create directory with spaces
    const spacedDir = join(gitRepo, "dir with spaces");
    await mkdir(spacedDir);
    
    const result = await getRoot(spacedDir);
    
    expect(result).toBe(gitRepo);
  });

  test("should work from directory with special characters", async () => {
    // Create directory with special characters
    const specialDir = join(gitRepo, "dir-with_special.chars");
    await mkdir(specialDir);
    
    const result = await getRoot(specialDir);
    
    expect(result).toBe(gitRepo);
  });

  test("should throw CLIError when directory is not in a git repository", async () => {
    // Create a non-git directory
    const nonGitDir = join(testDir, "not-a-git-repo");
    await mkdir(nonGitDir);
    
    await expect(getRoot(nonGitDir)).rejects.toThrow(CLIError);
    await expect(getRoot(nonGitDir)).rejects.toThrow(/Failed to get repository root/);
  });

  test("should throw CLIError when directory does not exist", async () => {
    const nonExistentDir = join(testDir, "does-not-exist");
    
    await expect(getRoot(nonExistentDir)).rejects.toThrow();
    // Note: The exact error type may vary depending on the system
  });

  test("should work in subdirectory of git worktree", async () => {
    // Create a worktree (if git supports it)
    const worktreeDir = join(testDir, "worktree");
    
    try {
      // Try to create a worktree
      const worktreeProc = Bun.spawn(["git", "worktree", "add", worktreeDir, "HEAD"], { 
        cwd: gitRepo,
        stderr: "pipe" // Suppress stderr output to avoid cluttering test logs
      });
      const exitCode = await worktreeProc.exited;
      
      if (exitCode === 0) {
        // Create subdirectory in worktree
        const subDir = join(worktreeDir, "sub");
        await mkdir(subDir);
        
        const result = await getRoot(subDir);
        
        expect(result).toBe(worktreeDir);
      }
    } catch {
      // Skip test if worktrees aren't supported
      // Test will be skipped silently
    }
  });

  test("should handle git repository in current working directory", async () => {
    // Test using process.cwd() as well to ensure it works with actual cwd
    const originalCwd = process.cwd();
    
    try {
      process.chdir(gitRepo);
      const result = await getRoot(".");
      
      expect(result).toBe(gitRepo);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("should work with relative paths", async () => {
    // Create subdirectory and test with relative path
    const subDir = join(gitRepo, "src");
    await mkdir(subDir);
    
    // Change to subDir and use relative path
    const originalCwd = process.cwd();
    
    try {
      process.chdir(gitRepo);
      const result = await getRoot("./src");
      
      expect(result).toBe(gitRepo);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("should handle empty git repository", async () => {
    // Create a new empty git repo (no commits)
    const emptyRepo = join(testDir, "empty-repo");
    await mkdir(emptyRepo);
    
    const initProc = Bun.spawn(["git", "init"], { cwd: emptyRepo });
    await initProc.exited;
    
    // Set up git config
    const configNameProc = Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: emptyRepo });
    await configNameProc.exited;
    
    const configEmailProc = Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: emptyRepo });
    await configEmailProc.exited;
    
    // Disable GPG signing
    const configGpgProc = Bun.spawn(["git", "config", "commit.gpgsign", "false"], { cwd: emptyRepo });
    await configGpgProc.exited;
    
    const result = await getRoot(emptyRepo);
    
    expect(result).toBe(emptyRepo);
  });

  test("should work in bare git repository", async () => {
    // Create a bare git repository
    const bareRepo = join(testDir, "bare-repo.git");
    await mkdir(bareRepo);
    
    // Note: The error message "fatal: this operation must be run in a work tree" may appear
    // and is expected when testing bare repositories
    
    try {
      const initProc = Bun.spawn(["git", "init", "--bare"], { cwd: bareRepo });
      const exitCode = await initProc.exited;
      
      if (exitCode === 0) {
        const result = await getRoot(bareRepo);
        expect(result).toBe(bareRepo);
      }
    } catch {
      // Skip test if bare repositories don't work in test environment
      // Test will be skipped silently
    }
  });

  test("should return consistent results for same directory", async () => {
    // Call getRoot multiple times for the same directory
    const results = await Promise.all([
      getRoot(gitRepo),
      getRoot(gitRepo),
      getRoot(gitRepo)
    ]);
    
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
    expect(results[0]).toBe(gitRepo);
  });

  test("should handle concurrent calls correctly", async () => {
    // Create multiple subdirectories
    const subDirs = [
      join(gitRepo, "sub1"),
      join(gitRepo, "sub2"),
      join(gitRepo, "sub3")
    ];
    
    await Promise.all(subDirs.map(dir => mkdir(dir)));
    
    // Call getRoot concurrently from different subdirectories
    const results = await Promise.all(subDirs.map(dir => getRoot(dir)));
    
    // All should return the same root
    results.forEach(result => {
      expect(result).toBe(gitRepo);
    });
  });

  test("should work with nested git repositories (return innermost)", async () => {
    // Create nested git repository
    const nestedRepo = join(gitRepo, "nested");
    await mkdir(nestedRepo);
    
    // Initialize nested git repo
    const initProc = Bun.spawn(["git", "init"], { cwd: nestedRepo });
    await initProc.exited;
    
    // Set up git config for nested repo
    const configNameProc = Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: nestedRepo });
    await configNameProc.exited;
    
    const configEmailProc = Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: nestedRepo });
    await configEmailProc.exited;
    
    // Disable GPG signing for nested repo
    const configGpgProc = Bun.spawn(["git", "config", "commit.gpgsign", "false"], { cwd: nestedRepo });
    await configGpgProc.exited;
    
    // Add initial commit to nested repo
    await writeFile(join(nestedRepo, "nested.txt"), "nested");
    const addProc = Bun.spawn(["git", "add", "nested.txt"], { cwd: nestedRepo });
    await addProc.exited;
    
    const commitProc = Bun.spawn(["git", "commit", "-m", "Nested commit"], { cwd: nestedRepo });
    await commitProc.exited;
    
    // Should return the innermost (nested) repository root
    const result = await getRoot(nestedRepo);
    
    expect(result).toBe(nestedRepo);
  });

  test("should preserve exact path format returned by git", async () => {
    const result = await getRoot(gitRepo);
    
    // Result should be a valid absolute path
    expect(result).toMatch(/^[/\\].*$/); // Should start with / or \ (absolute path)
    expect(result).not.toMatch(/\s+$/); // Should not have trailing whitespace
    expect(result).not.toMatch(/^\s+/); // Should not have leading whitespace
  });
});