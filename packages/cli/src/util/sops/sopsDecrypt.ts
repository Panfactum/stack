import { dirname } from "node:path";
import { type z } from "zod";
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
  }).catch((error: unknown) => {
    throw new CLIError(`Failed to decrypt sops file at ${filePath}`, error);
  });

  // Parse JSON output
  let decryptedData: unknown;
  try {
    decryptedData = JSON.parse(stdout);
  } catch (error) {
    throw new CLIError(`Invalid JSON output from sops decrypt for file at ${filePath}`, error);
  }

  // Validate with schema
  const parseResult = validationSchema.safeParse(decryptedData);
  if (!parseResult.success) {
    throw new PanfactumZodError(
      "Decrypted sops data did not match expected schema",
      filePath,
      parseResult.error
    );
  }

  return parseResult.data as z.infer<T>;
};
