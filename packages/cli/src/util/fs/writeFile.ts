import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { CLIError } from "@/util/error/error";
import { fileExists } from "./fileExists";
import type { PanfactumContext } from "@/util/context/context";

export async function writeFile({
  context,
  filePath,
  contents,
  overwrite = false
}: {
  context: PanfactumContext;
  filePath: string;
  contents: string;
  overwrite?: boolean;
}) {
  if (await fileExists(filePath)) {
    if (!overwrite) {
      throw new CLIError(`File already exists at ${filePath}. Use overwrite=true if you want to overwrite it without error.`)
    }
  }
  context.logger.debug(`Writing file`, { filePath });
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await Bun.write(filePath, contents);
  } catch (e) {
    throw new CLIError(`Error writing to ${filePath}`, e)
  }
  context.logger.debug(`Finished writing file`, { filePath });

}
