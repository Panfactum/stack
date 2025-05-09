import { dirname } from "node:path";
import { CLIError } from "../error/error";
import { fileExists } from "../fs/fileExists";
import { removeFile } from "../fs/removeFile";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";


interface Input {
  values: { [key: string]: unknown };
  filePath: string;
  context: PanfactumContext;
  overwrite?: boolean;
}

export const sopsWrite = async (input: Input) => {
  const { values, filePath, context, overwrite } = input;

  if (await fileExists(filePath)) {
    if (!overwrite) {
      throw new CLIError(`File already exists at ${filePath}. Use overwrite=true if you want to overwrite it without error.`)
    }
    await removeFile(filePath);
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
