import { join } from "path";
import { z } from "zod";
import { readYAMLFile } from "./readYAMLFile";
import { writeYAMLFile } from "./writeYAMLFile";
import { fileExists } from "../fs/fileExists";
import type { PanfactumContext } from "@/context/context";

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
  realModuleName?: string;
}) {
  const { context, environment, region, module, realModuleName, inputUpdates } =
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
        extra_inputs: inputUpdates,
        module: realModuleName,
      },
      overwrite: true,
    });
  }
}
