/**
 * Gets the repository root
 * @returns An absolute path to the repository root
 */
export async function getRoot(): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"])
  return (await new globalThis.Response(proc.stdout).text()).trim()
}
