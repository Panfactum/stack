// A TypeScript version of the -d $PATH shell command
export async function safeDirectoryExists(path: string) {
  try {
    const stats = await Bun.file(path).stat();
    return stats.isDirectory();
  } catch {
    return false;
  }
}
