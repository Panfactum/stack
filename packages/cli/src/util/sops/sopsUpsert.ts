import { dirname } from "node:path";
import { z } from "zod";
import { sopsDecrypt } from "./sopsDecrypt";
import { CLISubprocessError } from "../error/error";
import { fileExists } from "../fs/fileExists";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

interface Input {
  values: { [key: string]: string | string[] };
  filePath: string;
  context: PanfactumContext;
}

export const sopsUpsert = async (input: Input) => {
  const { values, filePath, context } = input;

  if (!(await fileExists(filePath))) {
    await createDirectoryPath(filePath, context);
    await writeEncryptedData(input);
  } else {
    const existingData = await sopsDecrypt({
      filePath,
      context,
      validationSchema: z.record(z.union([z.string(), z.array(z.string())])),
    });
    await writeEncryptedData({
      values: { ...existingData, ...values },
      filePath,
      context,
    });
  }
};

const createDirectoryPath = async (
  filePath: string,
  context: PanfactumContext
) => {
  const fileDir = dirname(filePath);
  if (fileDir !== process.cwd()) {
    try {
      await execute({
        command: ["mkdir", "-p", fileDir],
        context,
        workingDirectory: process.cwd(),
      });
    } catch (error) {
      throw new CLISubprocessError(
        "Unable to create directories for encrypted file",
        {
          command: `mkdir -p ${fileDir}`,
          subprocessLogs:
            error instanceof Error ? error.message : "Unknown error",
          workingDirectory: process.cwd(),
        }
      );
    }
  }
};

const writeEncryptedData = async ({ values, filePath, context }: Input) => {
  const command = [
    "sops",
    "-e",
    "--input-type",
    "json",
    "--output",
    filePath,
    "--filename-override",
    filePath,
    "/dev/stdin",
  ];
  try {
    await execute({
      command,
      context,
      workingDirectory: dirname(filePath),
      stdin: new globalThis.Blob([JSON.stringify(values)]),
    });
  } catch (error) {
    throw new CLISubprocessError("Unable to write encrypted data", {
      command: command.join(" "),
      subprocessLogs: error instanceof Error ? error.message : "Unknown error",
      workingDirectory: process.cwd(),
    });
  }
};
