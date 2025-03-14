export async function downloadFile(url: string, destination: string) {
  const response = await Bun.fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download: ${response.status} ${response.statusText}`
    );
  }

  // Will automatically write the response body to the destination file
  // See https://bun.sh/docs/api/file-io#writing-files-bun-write
  await Bun.write(destination, response);
}
