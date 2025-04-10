import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";

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
  if (overwrite || !(await Bun.file(path).exists())) {
    context.logger.log(`Writing ${path}`, {level: "debug"});
    try {
      await mkdir(dirname(path), { recursive: true });
      await Bun.write(path, contents);
    } catch (e) {
      throw new CLIError(`Error writing to ${path}`, e)      
    }
    context.logger.log(`Wrote ${path} successfully`, {level: "debug"});
  }
}
