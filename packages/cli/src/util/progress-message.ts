import type { BaseContext } from "clipanion";

export function progressMessage({
  context,
  message,
  interval = 5000,
}: {
  context: BaseContext;
  message: string;
  interval?: number;
}) {
  let dots = 0;
  context.stdout.write(`${message}\n`);
  return globalThis.setInterval(() => {
    dots = (dots + 1) % 5;
    const progressText = `${message}${".".repeat(dots)}`;
    context.stdout.write(`${progressText}\n`);
  }, interval);
}
