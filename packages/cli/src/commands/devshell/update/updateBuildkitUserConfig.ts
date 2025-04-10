import { z } from "zod";
import { safeFileExists } from "../../../util/fs/safe-file-exists";
import type { PanfactumContext } from "../../../context/context";

export async function updateBuildkitUserConfig({
  context,
}: {
  context: PanfactumContext;
}) {
  const buildkitDirPath = context.repoVariables.buildkit_dir;
  const authFilePath = buildkitDirPath + "/config.json";
  const buildkitFilePath = buildkitDirPath + "/buildkit.json";

  if (await safeFileExists(buildkitFilePath)) {
    if (!(await safeFileExists(authFilePath))) {
      await Bun.write(Bun.file(authFilePath), "{}");
    }
    const buildkitFile = Bun.file(buildkitFilePath);
    const buildkitFileJson = await buildkitFile.json();
    const buildkitFileSchema = z.object({
      credHelpers: z.record(z.string(), z.string()),
    });
    const buildkitFileParsed = buildkitFileSchema.parse(buildkitFileJson);
    const credHelpers = buildkitFileParsed.credHelpers;
    const authFile = Bun.file(authFilePath);
    const authFileJson = await authFile.json();
    const updatedAuthFile = {
      ...authFileJson,
      ...credHelpers,
    };
    await Bun.write(
      Bun.file(authFilePath),
      JSON.stringify(updatedAuthFile, null, 2)
    );
  }
}
