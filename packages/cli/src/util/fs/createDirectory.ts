import { mkdir } from "node:fs/promises";
import { CLIError } from "../error/error";

export const createDirectory = async (
    dirPath: string) => {
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new CLIError("Unable to create directory", error);
    }
  };