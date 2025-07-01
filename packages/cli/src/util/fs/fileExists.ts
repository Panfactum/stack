import { CLIError } from "@/util/error/error";

export const fileExists = async (filePath: string) => {
  try {
    return await Bun.file(filePath).exists();
  } catch (e) {
    throw new CLIError(`Unable to check file existence for ${filePath}`, e)
  }
};
