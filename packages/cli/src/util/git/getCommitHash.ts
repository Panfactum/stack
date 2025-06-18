import { mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { CLIError, PanfactumZodError } from '@/util/error/error';
import { execute } from '@/util/subprocess/execute';
import type { PanfactumContext } from '@/util/context/context';

// Schemas for validating git command outputs
const GIT_SHA_SCHEMA = z.string().regex(/^[0-9a-f]{40}$/i, 'Invalid git SHA format');
const GIT_OUTPUT_SCHEMA = z.string().min(1, 'Git command returned empty output');
const GIT_LS_REMOTE_SCHEMA = z.string().regex(/^[0-9a-f]{40}\t/, 'Invalid git ls-remote output format');

export interface GetCommitHashOptions {
  repo?: string;
  ref?: string;
  noVerify?: boolean;
  context: PanfactumContext;
  workingDirectory: string;
}

/**
 * Gets the current HEAD commit SHA from the local repository
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
 * Resolves git references (branches, tags, commits) to commit SHA hashes
 * @param options - Options for resolving the commit hash
 * @returns The resolved commit SHA
 */
export async function getCommitHash(options: GetCommitHashOptions): Promise<string> {
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