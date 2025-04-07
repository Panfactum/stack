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
  context.stdout.write(`${message}`);
  return globalThis.setInterval(() => {
    dots = (dots + 1) % 5;
    const progressText = `${message}${".".repeat(dots)}${" ".repeat(5 - dots)}`;
    context.stdout.write(`\r${progressText}`);
  }, interval);
}
