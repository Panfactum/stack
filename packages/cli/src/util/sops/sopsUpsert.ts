import { dirname } from "node:path";
import { z } from "zod";
import { createDirectory } from "@/util/fs/createDirectory";
import { fileExists } from "@/util/fs/fileExists";
import { sopsDecrypt } from "./sopsDecrypt";
import { sopsWrite } from "./sopsWrite";
import type { PanfactumContext } from "@/util/context/context";

interface Input {
  values: { [key: string]: string | string[] | undefined };
  filePath: string;
  context: PanfactumContext;
}

export const sopsUpsert = async (input: Input) => {
  const { values, filePath, context } = input;

  if (!(await fileExists(filePath))) {
    await createDirectory(dirname(filePath));
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