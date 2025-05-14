import { dirname } from "node:path";
import { z } from "zod";
import { sopsDecrypt } from "./sopsDecrypt";
import { sopsWrite } from "./sopsWrite";
import { createDirectory } from "../fs/createDirectory";
import { fileExists } from "../fs/fileExists";
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