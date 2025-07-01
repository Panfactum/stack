import { dirname } from "node:path";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { removeFile } from "@/util/fs/removeFile";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for sopsWrite function inputs
 */
interface ISopsWriteInputs {
  /** Values to write to the SOPS file */
  values: { [key: string]: unknown };
  /** Path to the SOPS file */
  filePath: string;
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Whether to overwrite existing file */
  overwrite?: boolean;
}

export const sopsWrite = async (input: ISopsWriteInputs) => {
  const { values, filePath, context, overwrite } = input;

  if (await fileExists({ filePath })) {
    if (!overwrite) {
      throw new CLIError(`File already exists at ${filePath}. Use overwrite=true if you want to overwrite it without error.`)
    }
    await removeFile({ filePath });
  }

  try {
    await execute({
      command: [
        "sops",
        "-e",
        "--input-type",
        "json",
        "--output",
        filePath,
        "--filename-override",
        filePath,
        "/dev/stdin",
      ],
      context,
      workingDirectory: dirname(filePath),
      stdin: new globalThis.Blob([JSON.stringify(values)]),
    });
  } catch (error) {
    throw new CLIError("Unable to write encrypted data", error);
  }
};
