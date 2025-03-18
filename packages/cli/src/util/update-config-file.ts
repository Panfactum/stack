import pc from "picocolors";
import { printHelpInformation } from "./print-help-information";
import type { BaseContext } from "clipanion";

// Helper function to update the configuration file
export const updateConfigFile = async ({
  updates,
  configPath,
  context,
}: {
  updates: Record<string, unknown>;
  configPath: string;
  context: BaseContext;
}): Promise<void | 1> => {
  try {
    const configData = JSON.parse(await Bun.file(configPath).text());
    // Update the config with all provided key-value pairs
    for (const [key, value] of Object.entries(updates)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      configData[key] = value;
    }
    await Bun.write(configPath, JSON.stringify(configData, null, 2));
    return;
  } catch (error) {
    context.stderr.write(
      pc.red(`Error updating configuration file: ${String(error)}\n`)
    );
    printHelpInformation(context);
    return 1;
  }
};
