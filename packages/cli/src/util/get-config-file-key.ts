import pc from "picocolors";
import type { BaseContext } from "clipanion";

export const getConfigFileKey = async ({
  key,
  configPath,
  context,
}: {
  key: string;
  configPath: string;
  context: BaseContext;
}): Promise<unknown | undefined> => {
  try {
    const configData = JSON.parse(await Bun.file(configPath).text());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return configData[key];
  } catch (error) {
    context.stderr.write(
      pc.red(`Error reading configuration file: ${String(error)}\n`)
    );
    return undefined;
  }
};
