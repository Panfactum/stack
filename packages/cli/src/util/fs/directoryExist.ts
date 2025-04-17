export async function directoryExists(path: string) {
  try {
    const stats = await Bun.file(path).stat();
    return stats.isDirectory();
  } catch {
    return false;
  }
}
