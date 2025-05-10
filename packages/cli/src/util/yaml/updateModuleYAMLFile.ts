import { join } from "path";
import { z } from "zod";
import { CLIError } from "@/util/error/error";
import { readYAMLFile } from "./readYAMLFile";
import { writeYAMLFile } from "./writeYAMLFile";
import { fileExists } from "../fs/fileExists";
import type { PanfactumContext } from "@/util/context/context";

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

export async function updateModuleYAMLFile(inputs: {
  context: PanfactumContext;
  environment: string;
  region: string;
  module: string;
  inputUpdates: Record<string, JSONValue>;
  rootUpdates?: Record<string, JSONValue>;
  realModuleName?: string;
}): Promise<void>;
// eslint-disable-next-line no-redeclare
export async function updateModuleYAMLFile(inputs: {
  context: PanfactumContext;
  environment: string;
  region: string;
  module: string;
  inputUpdates?: Record<string, JSONValue>;
  rootUpdates: Record<string, JSONValue>;
  realModuleName?: string;
}): Promise<void>;
// eslint-disable-next-line no-redeclare
export async function updateModuleYAMLFile(inputs: {
  context: PanfactumContext;
  environment: string;
  region: string;
  module: string;
  inputUpdates?: Record<string, JSONValue>;
  rootUpdates?: Record<string, JSONValue>;
  realModuleName?: string;
}) {
  if (!inputs.inputUpdates && !inputs.rootUpdates) {
    throw new CLIError("Either inputUpdates or rootUpdates must be provided");
  }

  const { context, environment, region, module, realModuleName, inputUpdates, rootUpdates } =
    inputs;

  const moduleDir = join(
    context.repoVariables.environments_dir,
    environment,
    region,
    module
  );

  const moduleYAMLPath = join(moduleDir, "module.yaml");
  if (await fileExists(moduleYAMLPath)) {
    const originalModuleConfig = await readYAMLFile({
      filePath: moduleYAMLPath,
      context,
      validationSchema: z
        .object({
          extra_inputs: z.record(z.any()).optional().default({}),
        })
        .passthrough(),
    });
    const newModuleConfig = {
      module: realModuleName,
      ...originalModuleConfig,
      ...rootUpdates,
      extra_inputs: {
        ...originalModuleConfig?.extra_inputs,
        ...inputUpdates,
      },
    };
    await writeYAMLFile({
      context,
      path: moduleYAMLPath,
      contents: newModuleConfig,
      overwrite: true,
    });
  } else {
    await writeYAMLFile({
      context,
      path: moduleYAMLPath,
      contents: {
        ...rootUpdates,
        extra_inputs: inputUpdates,
        module: realModuleName,
      },
      overwrite: true,
    });
  }
}
