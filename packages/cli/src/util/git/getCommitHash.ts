import { $ } from 'bun';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface GetCommitHashOptions {
  repo?: string;
  ref?: string;
  noVerify?: boolean;
}

/**
 * Resolves git references (branches, tags, commits) to commit SHA hashes
 * @param options - Options for resolving the commit hash
 * @returns The resolved commit SHA
 */
export async function getCommitHash(options: GetCommitHashOptions = {}): Promise<string> {
  const { repo = 'origin', ref, noVerify = false } = options;

  // Special case: local ref
  if (ref === 'local') {
    return 'local';
  }

  // If no ref is provided
  if (!ref) {
    // If repo is origin, get current HEAD
    if (repo === 'origin') {
      const result = await $`git rev-parse HEAD`.quiet();
      return result.text().trim();
    } else {
      throw new Error('You cannot specify an empty git_ref and also specify a git_repo. Too ambiguous to resolve the hash.');
    }
  }

  // If ref is already a 40-char SHA
  if (/^[0-9a-f]{40}$/i.test(ref)) {
    if (!noVerify) {
      if (repo === 'origin') {
        // Verify it exists in origin
        try {
          await $`git fetch origin ${ref}`.quiet();
          return ref;
        } catch {
          throw new Error(`Commit ${ref} does not exist in the remote origin`);
        }
      } else {
        // Create temp dir and verify from custom repo
        const tempDir = await mkdtemp(join(tmpdir(), 'pf-git-'));
        try {
          await $`git init -q`.cwd(tempDir).quiet();
          await $`git fetch ${repo} ${ref}`.cwd(tempDir).quiet();
          return ref;
        } catch {
          throw new Error(`Commit ${ref} does not exist in ${repo}`);
        } finally {
          await rmdir(tempDir, { recursive: true });
        }
      }
    }
    return ref;
  }

  // Otherwise, we need to resolve the ref to a SHA
  if (repo === 'origin') {
    // Check if the repo has no commits
    try {
      await $`git rev-parse --verify HEAD`.quiet();
    } catch {
      return 'local';
    }

    // Try to resolve the ref
    try {
      const result = await $`git rev-parse ${ref}`.quiet();
      return result.text().trim();
    } catch {
      throw new Error(`Unable to resolve git reference: ${ref}`);
    }
  } else {
    // Use git ls-remote for custom repos
    try {
      const result = await $`git ls-remote --exit-code ${repo} ${ref}`.quiet();
      const output = result.text().trim();
      if (output) {
        const sha = output.split('\t')[0];
        return sha || '';
      }
      throw new Error(`Unable to resolve git reference: ${ref} in ${repo}`);
    } catch {
      throw new Error(`Unable to resolve git reference: ${ref} in ${repo}`);
    }
  }
}