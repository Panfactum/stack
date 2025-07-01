import { stringify } from "yaml";
import { writeFile } from "@/util/fs/writeFile";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for writeYAMLFile function inputs
 */
interface IWriteYAMLFileInputs {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** The values to write to the YAML file */
  values: unknown;
  /** Whether to overwrite existing file */
  overwrite?: boolean;
  /** Path to the YAML file to write */
  filePath: string;
}

export async function writeYAMLFile(inputs: IWriteYAMLFileInputs) {
    const { context, values, overwrite, filePath } = inputs;

    await writeFile({
        context,
        filePath,
        contents: stringify(values, { doubleQuotedAsJSON: true }),
        overwrite
    })
}