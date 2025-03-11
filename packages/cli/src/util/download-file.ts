export async function downloadFile(url: string, destination: string) {
  const response = await Bun.fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download: ${response.status} ${response.statusText}`
    );
  }

  const fileData = await response.arrayBuffer();
  await Bun.write(destination, fileData);
}
