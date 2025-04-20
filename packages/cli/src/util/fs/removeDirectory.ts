import { rm } from "node:fs/promises";
import { CLIError } from "../error/error";

export const removeDirectory = async (
    dirPath: string) => {
    try {
      await rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      throw new CLIError("Unable to delete directory", error);
    }
  };