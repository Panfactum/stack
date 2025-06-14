import { mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { CLIError } from '@/util/error/error';
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
  });
  
  const sha = GIT_OUTPUT_SCHEMA.parse(stdout.trim());
  return GIT_SHA_SCHEMA.parse(sha);
}

/**
 * Checks if the repository has any commits (i.e., HEAD exists)
 */
async function hasCommits(context: PanfactumContext, workingDirectory: string): Promise<boolean> {
  try {
    await execute({
      command: ['git', 'rev-parse', '--verify', 'HEAD'],
      context,
      workingDirectory,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a git reference to its commit SHA using git rev-parse
 */
async function resolveRefToSha(ref: string, context: PanfactumContext, workingDirectory: string): Promise<string> {
  const { stdout } = await execute({
    command: ['git', 'rev-parse', ref],
    context,
    workingDirectory,
  });
  
  const sha = GIT_OUTPUT_SCHEMA.parse(stdout.trim());
  return GIT_SHA_SCHEMA.parse(sha);
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
  });
  
  const output = GIT_LS_REMOTE_SCHEMA.parse(stdout.trim());
  const sha = output.split('\t')[0];
  
  if (!sha) {
    throw new CLIError(`Unable to resolve git reference: ${ref} in ${repo}`);
  }
  
  return GIT_SHA_SCHEMA.parse(sha);
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
      try {
        if (repo === 'origin') {
          await verifyCommitInOrigin(ref, context, workingDirectory);
        } else {
          await verifyCommitInCustomRepo(ref, repo, context);
        }
      } catch {
        throw new CLIError(`Commit ${ref} does not exist in ${repo === 'origin' ? 'the remote origin' : repo}`);
      }
    }
    return ref;
  }

  // Otherwise, we need to resolve the ref to a SHA
  if (repo === 'origin') {
    // Check if the repo has no commits
    if (!(await hasCommits(context, workingDirectory))) {
      return 'local';
    }

    // Try to resolve the ref
    try {
      return await resolveRefToSha(ref, context, workingDirectory);
    } catch {
      throw new CLIError(`Unable to resolve git reference: ${ref}`);
    }
  } else {
    // Use git ls-remote for custom repos
    try {
      return await resolveRefWithLsRemote(ref, repo, context, workingDirectory);
    } catch {
      throw new CLIError(`Unable to resolve git reference: ${ref} in ${repo}`);
    }
  }
}