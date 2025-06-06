import { rm } from "node:fs/promises";
import { CLIError } from "@/util/error/error";

export const removeFile = async (
  filePath: string) => {
  try {
    await rm(filePath, { force: true });
  } catch (error) {
    throw new CLIError(`Unable to delete file at ${filePath}`, error);
  }
};