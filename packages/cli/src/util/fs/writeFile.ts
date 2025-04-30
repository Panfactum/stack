import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/util/context/context";

export async function writeFile({
  context,
  path,
  contents,
  overwrite = false
}: {
  context: PanfactumContext;
  path: string;
  contents: string;
  overwrite?: boolean;
}) {
  if (await Bun.file(path).exists()) {
    if (!overwrite) {
      throw new CLIError(`File already exists at ${path}. Use overwrite=true if you want to overwrite it without error.`)
    }
  }
  context.logger.debug(`Writing file`, { filePath: path });
  try {
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, contents);
  } catch (e) {
    throw new CLIError(`Error writing to ${path}`, e)
  }
  context.logger.debug(`Finished writing file`, { filePath: path });

}
