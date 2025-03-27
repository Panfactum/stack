import { safeFileExists } from "../../safe-file-exists";

/**
 * Generates an MD5 hash of the content of a file
 * @param filePath - The path to the file to hash
 * @returns A promise that resolves to the MD5 hash of the file content
 */
export async function getFileMd5Hash(filePath: string) {
  if (!(await safeFileExists(filePath))) {
    return "";
  }

  const fileContent = await Bun.file(filePath).text();
  const hasher = new Bun.CryptoHasher("md5");
  return hasher.update(fileContent).digest("hex");
}
