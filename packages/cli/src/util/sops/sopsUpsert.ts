import { dirname } from "node:path";
import { z } from "zod";
import { sopsDecrypt } from "./sopsDecrypt";
import { CLIError } from "../error/error";
import { fileExists } from "../fs/fileExists";
import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";
import { createDirectory } from "../fs/createDirectory";


interface Input {
  values: { [key: string]: string | string[] };
  filePath: string;
  context: PanfactumContext;
}

export const sopsUpsert = async (input: Input) => {
  const { values, filePath, context } = input;

  if (!(await fileExists(filePath))) {
    await createDirectory(dirname(filePath));
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

const writeEncryptedData = async ({ values, filePath, context }: Input) => {
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
