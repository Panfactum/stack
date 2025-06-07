import { dirname } from "node:path";
import { ZodError, type z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { execute } from "@/util/subprocess/execute";
import type { PanfactumContext } from "@/util/context/context";

export const sopsDecrypt = async <T extends z.ZodType<object>>({
  filePath,
  context,
  validationSchema,
  throwOnMissing
}: {
  filePath: string;
  context: PanfactumContext;
  validationSchema: T;
  throwOnMissing?: boolean;
}) => {

  if (!(await fileExists(filePath))) {
    if (throwOnMissing) {
      throw new CLIError(`sops-encrypted file does not exist at ${filePath}`);
    } else {
      return null;
    }
  }

  const { stdout } = await execute({
    command: ["sops", "-d", "--output-type", "json", filePath],
    context,
    workingDirectory: dirname(filePath),
  });
  try {
    return validationSchema.parse(JSON.parse(stdout)) as z.infer<T>;
  } catch (e) {
    if (e instanceof ZodError) {
      throw new PanfactumZodError(
        "Decrypted sops data did not match expected schema",
        filePath,
        e
      );
    } else {
      throw new CLIError("Error parsing decrypted sops data", e);
    }
  }

};
