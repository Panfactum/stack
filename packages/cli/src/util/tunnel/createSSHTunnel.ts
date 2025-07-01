import { join } from 'path';
import { z } from 'zod';
import { CLIError, PanfactumZodError } from '@/util/error/error.js';
import { fileExists } from '@/util/fs/fileExists.js';
import { removeFile } from '@/util/fs/removeFile.js';
import { writeFile } from '@/util/fs/writeFile.js';
import { execute } from '@/util/subprocess/execute.js';
import { killBackgroundProcess } from '@/util/subprocess/killBackgroundProcess.js';
import { getVaultToken } from '@/util/vault/getVaultToken.js';
import type { PanfactumContext } from '@/util/context/context.js';

// Zod schema for port validation
export const portSchema = z.number().int().min(1).max(65535);

export interface SSHTunnelOptions {
  context: PanfactumContext;
  bastionName: string;
  remoteAddress: string;
  localPort: number;
  vaultAddress: string;
}

export interface SSHTunnelHandle {
  pid: number;
  localPort: number;
  remoteAddress: string;
  bastionName: string;
  close: () => Promise<void>;
}

export async function createSSHTunnel(options: SSHTunnelOptions): Promise<SSHTunnelHandle> {
  const {
    context,
    bastionName,
    remoteAddress,
    localPort,
    vaultAddress
  } = options;

  // Get SSH directory from context
  const sshDir = context.repoVariables.ssh_dir;

  // Read connection info to get bastion details
  const connectionInfoFile = join(sshDir, 'connection_info');
  if (!(await fileExists(connectionInfoFile))) {
    throw new CLIError(
      `Connection info file not found at ${connectionInfoFile}. Run pf devshell sync to generate it.`
    );
  }

  // Schema for connection info line validation
  const connectionInfoLineSchema = z.string()
    .transform((line) => {
      const parts = line.split(' ');
      if (parts.length !== 3) {
        throw new Error('Invalid format');
      }
      return {
        name: parts[0],
        domain: parts[1],
        port: parts[2]
      };
    })
    .pipe(z.object({
      name: z.string().min(1),
      domain: z.string().min(1),
      port: z.string().regex(/^\d+$/).transform(Number).pipe(portSchema)
    }));

  const connectionInfo = await Bun.file(connectionInfoFile).text()
    .catch((error: unknown) => {
      throw new CLIError(
        `Failed to read connection info from ${connectionInfoFile}`,
        error
      );
    });

  const bastionLine = connectionInfo.split('\n').find(line => line.startsWith(`${bastionName} `));

  if (!bastionLine) {
    throw new CLIError(
      `${bastionName} not found in ${connectionInfoFile}. Ensure this name is correct or run pf devshell sync to regenerate this file.`
    );
  }

  // Parse connection data synchronously
  const parseResult = connectionInfoLineSchema.safeParse(bastionLine);
  if (!parseResult.success) {
    throw new PanfactumZodError(
      `Invalid connection info format for ${bastionName}`,
      connectionInfoFile,
      parseResult.error
    );
  }
  const connectionData = parseResult.data;
  const bastionDomain = connectionData.domain;
  const bastionPort = connectionData.port.toString();

  // Setup SSH keys
  const keyFile = join(sshDir, `id_ed25519_${bastionName}`);
  const publicKeyFile = `${keyFile}.pub`;
  const signedPublicKeyFile = `${keyFile}_signed.pub`;

  // Generate keys if they don't exist
  if (!(await fileExists(keyFile)) || !(await fileExists(publicKeyFile)) || !(await fileExists(signedPublicKeyFile))) {
    context.logger.info('Generating SSH keys...');

    // Clean up any partial keys
    for (const file of [keyFile, publicKeyFile, signedPublicKeyFile]) {
      if (await fileExists(file)) {
        await removeFile(file);
      }
    }

    // Generate new keys
    await execute({
      command: [
        'ssh-keygen',
        '-q',
        '-t', 'ed25519',
        '-N', '',
        '-C', bastionName,
        '-f', keyFile
      ],
      context,
      workingDirectory: process.cwd(),
    }).catch((error: unknown) => {
      throw new CLIError(
        `Failed to generate SSH keys for ${bastionName}`,
        error
      );
    });
  }

  // Sign SSH key with Vault
  const vaultToken = await getVaultToken({ context, address: vaultAddress });

  const result = await execute({
    command: [
      'vault',
      'write',
      '-field',
      'signed_key',
      'ssh/sign/default',
      `public_key=@${publicKeyFile}`
    ],
    context,
    workingDirectory: process.cwd(),
    env: {
      ...process.env,
      VAULT_ADDR: vaultAddress,
      VAULT_TOKEN: vaultToken
    }
  }).catch((error: unknown) => {
    throw new CLIError(
      `Failed to sign SSH key with Vault for ${bastionName}`,
      error
    );
  });
  
  const signedKey = result.stdout;
  
  if (!signedKey || signedKey.trim().length === 0) {
    throw new CLIError(
      `Vault returned empty signed key for ${bastionName}`
    );
  }

  context.logger.info('SSH Key signed successfully');
  await writeFile({
    context,
    filePath: signedPublicKeyFile,
    contents: signedKey,
    overwrite: true
  }).catch((error: unknown) => {
    throw new CLIError(
      `Failed to write signed SSH key to ${signedPublicKeyFile}`,
      error
    );
  });

  // Establish tunnel using execute with background mode
  const knownHostsFile = join(sshDir, 'known_hosts');
  
  const tunnelResult = await execute({
    command: [
      'autossh',
      '-M', '0',
      '-o', `UserKnownHostsFile=${knownHostsFile}`,
      '-o', 'IdentitiesOnly=yes',
      '-o', 'IdentityAgent=none',
      '-o', 'ServerAliveInterval=2',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ConnectTimeout=1',
      '-N',
      '-i', keyFile,
      '-i', signedPublicKeyFile,
      '-L', `127.0.0.1:${localPort}:${remoteAddress}`,
      '-p', bastionPort,
      `panfactum@${bastionDomain}`
    ],
    context,
    workingDirectory: process.cwd(),
    env: {
      ...process.env,
      AUTOSSH_GATETIME: '0'
    },
    background: true,
    backgroundDescription: `SSH tunnel to ${remoteAddress} via ${bastionName}`
  }).catch((error: unknown) => {
    throw new CLIError(
      `Failed to establish SSH tunnel to ${remoteAddress} via ${bastionName}`,
      error
    );
  });

  if (!tunnelResult.pid) {
    throw new CLIError('Failed to start SSH tunnel - no process ID returned');
  }

  context.logger.info(
    `Tunnel established: localhost:${localPort} → ${remoteAddress} via ${bastionName}`
  );

  // Return handle for managing the tunnel
  return {
    pid: tunnelResult.pid,
    localPort,
    remoteAddress,
    bastionName,
    close: async () => {
      context.logger.info('Closing tunnel...');
      killBackgroundProcess({
        pid: tunnelResult.pid,
        context,
        killChildren: true
      });
    }
  };
}