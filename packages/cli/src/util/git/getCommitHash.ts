import { $ } from 'bun';

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

  // If no ref and repo is origin, get current HEAD
  if (!ref && repo === 'origin') {
    const result = await $`git rev-parse HEAD`.quiet();
    return result.text().trim();
  }

  // If ref is provided
  if (ref) {
    // Check if it's already a 40-char SHA
    if (/^[0-9a-f]{40}$/i.test(ref)) {
      if (!noVerify) {
        // Verify it exists
        try {
          await $`git cat-file -e ${ref}^{commit}`.quiet();
          return ref;
        } catch {
          throw new Error(`Commit ${ref} does not exist in the repository`);
        }
      }
      return ref;
    }

    // If repo is origin, resolve remote ref
    if (repo === 'origin') {
      try {
        const result = await $`git ls-remote origin ${ref}`.quiet();
        const output = result.text().trim();
        if (output) {
          const sha = output.split('\t')[0];
          return sha || '';
        }
      } catch {
        // Fall through to local resolution
      }
    }

    // Try to resolve as local ref
    try {
      const result = await $`git rev-parse ${ref}`.quiet();
      return result.text().trim();
    } catch {
      throw new Error(`Unable to resolve git reference: ${ref}`);
    }
  }

  throw new Error('Either ref must be provided or repo must be "origin"');
}