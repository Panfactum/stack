import pc from "picocolors";
import type { BaseContext } from "clipanion";

export async function testVpcNetworkBlocking({
  natIp,
  context,
}: {
  natIp: string;
  context: BaseContext;
}) {
  const process = Bun.spawnSync(["ping", "-q", "-w", "3", "-c", "1", natIp], {
    stdout: "ignore",
    stderr: "ignore",
  });

  if (process.exitCode !== 0) {
    context.stderr.write(pc.red(`Network traffic not blocked to ${natIp}!`));
    throw new Error(`Network traffic not blocked to ${natIp}!`);
  }
}
