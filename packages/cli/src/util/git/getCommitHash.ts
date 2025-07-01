// This file provides utilities for resolving Git references to commit hashes
// It supports branches, tags, and commit SHAs from local and remote repositories

import { mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { CLIError, PanfactumZodError } from '@/util/error/error';
import { execute } from '@/util/subprocess/execute';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Schema for validating 40-character Git SHA hashes
 * 
 * @remarks
 * Git commit SHAs are always 40 hexadecimal characters.
 * This schema ensures we have a valid full-length SHA.
 */
const GIT_SHA_SCHEMA = z.string().regex(/^[0-9a-f]{40}$/i, 'Invalid git SHA format')
  .describe("Git commit SHA validation");

/**
 * Schema for validating non-empty Git command output
 */
const GIT_OUTPUT_SCHEMA = z.string().min(1, 'Git command returned empty output')
  .describe("Non-empty git command output");

/**
 * Schema for validating git ls-remote output format
 * 
 * @remarks
 * Git ls-remote returns lines in format: "SHA\tref_name"
 * This schema validates the SHA portion exists.
 */
const GIT_LS_REMOTE_SCHEMA = z.string().regex(/^[0-9a-f]{40}\t/, 'Invalid git ls-remote output format')
  .describe("Git ls-remote output validation");

/**
 * Options for resolving Git references to commit hashes
 */
export interface IGetCommitHashOptions {
  /** Git repository URL or 'origin' for current repo's origin (default: 'origin') */
  repo?: string;
  /** Git reference (branch, tag, commit SHA) to resolve */
  ref?: string;
  /** Skip verification that commit exists in remote (default: false) */
  noVerify?: boolean;
  /** Panfactum context for command execution */
  context: PanfactumContext;
  /** Directory containing the Git repository */
  workingDirectory: string;
}

/**
 * Gets the current HEAD commit SHA from the local repository
 * 
 * @internal
 * @param context - Panfactum context for command execution
 * @param workingDirectory - Git repository directory
 * @returns Current HEAD commit SHA
 * 
 * @throws {@link CLIError}
 * Throws when git rev-parse fails
 * 
 * @throws {@link PanfactumZodError}
 * Throws when output is not a valid SHA
 */
async function getCurrentHead(context: PanfactumContext, workingDirectory: string): Promise<string> {
  const { stdout } = await execute({
    command: ['git', 'rev-parse', 'HEAD'],
    context,
    workingDirectory,
  }).catch((error: unknown) => {
    throw new CLIError('Failed to get current HEAD commit', error);
  });
  
  const trimmed = stdout.trim();
  const outputResult = GIT_OUTPUT_SCHEMA.safeParse(trimmed);
  if (!outputResult.success) {
    throw new PanfactumZodError(
      'Invalid git HEAD commit format',
      'git rev-parse HEAD',
      outputResult.error
    );
  }
  
  const shaResult = GIT_SHA_SCHEMA.safeParse(outputResult.data);
  if (!shaResult.success) {
    throw new PanfactumZodError(
      'Invalid git HEAD commit format',
      'git rev-parse HEAD',
      shaResult.error
    );
  }
  
  return shaResult.data;
}

/**
 * Checks if the repository has any commits (i.e., HEAD exists)
 */
async function hasCommits(context: PanfactumContext, workingDirectory: string): Promise<boolean> {
  return execute({
    command: ['git', 'rev-parse', '--verify', 'HEAD'],
    context,
    workingDirectory,
  })
    .then(() => true)
    .catch(() => false);
}

/**
 * Resolves a git reference to its commit SHA using git rev-parse
 */
async function resolveRefToSha(ref: string, context: PanfactumContext, workingDirectory: string): Promise<string> {
  const { stdout } = await execute({
    command: ['git', 'rev-parse', ref],
    context,
    workingDirectory,
  }).catch((error: unknown) => {
    throw new CLIError(`Failed to resolve git reference '${ref}'`, error);
  });
  
  const trimmed = stdout.trim();
  const outputResult = GIT_OUTPUT_SCHEMA.safeParse(trimmed);
  if (!outputResult.success) {
    throw new PanfactumZodError(
      `Invalid git reference format for '${ref}'`,
      'git rev-parse',
      outputResult.error
    );
  }
  
  const shaResult = GIT_SHA_SCHEMA.safeParse(outputResult.data);
  if (!shaResult.success) {
    throw new PanfactumZodError(
      `Invalid git reference format for '${ref}'`,
      'git rev-parse',
      shaResult.error
    );
  }
  
  return shaResult.data;
}

/**
 * Verifies that a commit SHA exists in the origin repository
 */
async function verifyCommitInOrigin(sha: string, context: PanfactumContext, workingDirectory: string): Promise<void> {
  await execute({
    command: ['git', 'fetch', 'origin', sha],
    context,
    workingDirectory,
  });
}

/**
 * Verifies that a commit SHA exists in a custom repository using a temporary directory
 */
async function verifyCommitInCustomRepo(sha: string, repo: string, context: PanfactumContext): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), 'pf-git-'));

  try {
    await execute({
      command: ['git', 'init', '-q'],
      context,
      workingDirectory: tempDir,
    });
    
    await execute({
      command: ['git', 'fetch', repo, sha],
      context,
      workingDirectory: tempDir,
    });
  } finally {
    await rmdir(tempDir, { recursive: true });
  }
}

/**
 * Resolves a git reference using git ls-remote for custom repositories
 */
async function resolveRefWithLsRemote(ref: string, repo: string, context: PanfactumContext, workingDirectory: string): Promise<string> {
  const { stdout } = await execute({
    command: ['git', 'ls-remote', '--exit-code', repo, ref],
    context,
    workingDirectory,
  }).catch((error: unknown) => {
    throw new CLIError(`Failed to resolve git reference '${ref}' in '${repo}'`, error);
  });
  
  const trimmed = stdout.trim();
  const outputResult = GIT_LS_REMOTE_SCHEMA.safeParse(trimmed);
  if (!outputResult.success) {
    throw new PanfactumZodError(
      `Invalid git ls-remote output format for '${ref}' in '${repo}'`,
      'git ls-remote',
      outputResult.error
    );
  }
  
  const sha = outputResult.data.split('\t')[0];
  if (!sha) {
    throw new CLIError(`Unable to resolve git reference: ${ref} in ${repo}`);
  }
  
  const shaResult = GIT_SHA_SCHEMA.safeParse(sha);
  if (!shaResult.success) {
    throw new PanfactumZodError(
      `Invalid git ls-remote output format for '${ref}' in '${repo}'`,
      'git ls-remote',
      shaResult.error
    );
  }
  
  return shaResult.data;
}

/**
 * Resolves Git references to their full commit SHA hashes
 * 
 * @remarks
 * This function provides a flexible way to resolve various Git references
 * (branches, tags, short SHAs) to their full 40-character commit hashes.
 * It supports both local repositories and custom remote repositories.
 * 
 * Key features:
 * - **Reference Resolution**: Converts branches/tags to commit SHAs
 * - **SHA Validation**: Verifies commit exists in the repository
 * - **Remote Support**: Works with custom Git repositories
 * - **Special Cases**: Handles empty repos and local-only refs
 * 
 * Resolution process:
 * 1. If ref is "local", returns "local" (special case)
 * 2. If no ref provided, returns current HEAD
 * 3. If ref is already a 40-char SHA, validates and returns it
 * 4. Otherwise, resolves the ref to its commit SHA
 * 
 * Common use cases:
 * - Pinning module versions to specific commits
 * - Validating user-provided Git references
 * - Ensuring reproducible deployments
 * - Cross-repository module references
 * 
 * @param options - Configuration for commit hash resolution
 * @returns Resolved 40-character commit SHA or "local"
 * 
 * @example
 * ```typescript
 * // Get current HEAD commit
 * const currentCommit = await getCommitHash({
 *   context,
 *   workingDirectory: '/path/to/repo'
 * });
 * 
 * // Resolve a branch to its commit
 * const mainCommit = await getCommitHash({
 *   context,
 *   workingDirectory: '/path/to/repo',
 *   ref: 'main'
 * });
 * 
 * // Resolve from custom repository
 * const externalCommit = await getCommitHash({
 *   context,
 *   workingDirectory: '/path/to/repo',
 *   repo: 'https://github.com/example/repo.git',
 *   ref: 'v1.2.3'
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when Git commands fail or references can't be resolved
 * 
 * @throws {@link CLIError}
 * Throws when specifying empty ref with custom repo (ambiguous)
 * 
 * @throws {@link CLIError}
 * Throws when commit doesn't exist in specified repository
 * 
 * @throws {@link PanfactumZodError}
 * Throws when Git output doesn't match expected format
 * 
 * @see {@link execute} - For running Git commands
 */
export async function getCommitHash(options: IGetCommitHashOptions): Promise<string> {
  const { repo = 'origin', ref, noVerify = false, context, workingDirectory } = options;

  // Special case: local ref
  if (ref === 'local') {
    return 'local';
  }

  // If no ref is provided
  if (!ref) {
    if (repo === 'origin') {
      return getCurrentHead(context, workingDirectory);
    } else {
      throw new CLIError('You cannot specify an empty git_ref and also specify a git_repo. Too ambiguous to resolve the hash.');
    }
  }

  // If ref is already a 40-char SHA
  if (/^[0-9a-f]{40}$/i.test(ref)) {
    if (!noVerify) {
      const verifyPromise = repo === 'origin'
        ? verifyCommitInOrigin(ref, context, workingDirectory)
        : verifyCommitInCustomRepo(ref, repo, context);
      
      await verifyPromise
        .catch((error: unknown) => {
          throw new CLIError(`Commit ${ref} does not exist in ${repo === 'origin' ? 'the remote origin' : repo}`, error);
        });
    }
    return ref;
  }

  // Otherwise, we need to resolve the ref to a SHA
  if (repo === 'origin') {
    // Check if the repo has no commits
    const hasCommitsResult = await hasCommits(context, workingDirectory);
    if (!hasCommitsResult) {
      return 'local';
    }
    // Try to resolve the ref
    return resolveRefToSha(ref, context, workingDirectory);
  } else {
    // Use git ls-remote for custom repos
    return resolveRefWithLsRemote(ref, repo, context, workingDirectory);
  }
}