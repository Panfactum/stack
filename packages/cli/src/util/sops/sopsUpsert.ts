import { dirname } from "node:path";
import { z } from "zod";
import { createDirectory } from "@/util/fs/createDirectory";
import { fileExists } from "@/util/fs/fileExists";
import { sopsDecrypt } from "./sopsDecrypt";
import { sopsWrite } from "./sopsWrite";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for sopsUpsert function inputs
 */
interface ISopsUpsertInputs {
  /** Values to upsert in the SOPS file */
  values: { [key: string]: string | string[] | undefined };
  /** Path to the SOPS file */
  filePath: string;
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
}

export const sopsUpsert = async (input: ISopsUpsertInputs) => {
  const { values, filePath, context } = input;

  if (!(await fileExists({ filePath }))) {
    await createDirectory({ dirPath: dirname(filePath) });
    await sopsWrite(input);
  } else {
    const existingData = await sopsDecrypt({
      filePath,
      context,
      validationSchema: z.record(z.unknown()),
    });
    await sopsWrite({
      values: { ...existingData, ...values },
      filePath,
      context,
      overwrite: true
    });
  }
};