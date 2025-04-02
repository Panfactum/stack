import { ensureFileExists } from "./ensure-file-exists";
import type { BaseContext } from "clipanion";

export const sopsEncrypt = async ({
  errorMessage,
  fileContents,
  filePath,
  context,
  tempFilePath,
}: {
  errorMessage: string;
  fileContents: string;
  filePath: string;
  context: BaseContext;
  tempFilePath: string;
}) => {
  const tempSecretsFilePath = tempFilePath;
  await Bun.write(tempSecretsFilePath, fileContents);

  const result = Bun.spawnSync(["sops", "encrypt", "-i", tempSecretsFilePath]);
  if (!result.success) {
    context.stderr.write(result.stderr.toString());
    const file = Bun.file(tempSecretsFilePath);
    await file.delete();
    throw new Error(errorMessage);
  }

  try {
    await ensureFileExists({
      context,
      destinationFile: filePath,
      sourceFile: await Bun.file(tempSecretsFilePath).text(),
    });
  } finally {
    const file = Bun.file(tempSecretsFilePath);
    await file.delete();
  }
};
