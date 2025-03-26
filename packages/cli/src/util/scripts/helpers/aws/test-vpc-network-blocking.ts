import pc from "picocolors";
import type { BaseContext } from "clipanion";

/**
 * Tests if network traffic to a specified NAT IP address is blocked.
 *
 * This function attempts to ping the provided NAT IP address and checks
 * if all packets are lost, which indicates that network traffic is properly blocked.
 * If any packets get through, it throws an error indicating that the network
 * is not properly blocked.
 *
 * @param {Object} options - The options object.
 * @param {string} options.natIp - The NAT IP address to test.
 * @param {BaseContext} options.context - The Clipanion base context for output.
 * @param {boolean} [options.verbose=false] - Whether to output verbose logs.
 * @throws {Error} Throws an error if network traffic is not blocked to the NAT IP.
 */
export async function testVpcNetworkBlocking({
  natIp,
  context,
  verbose = false,
}: {
  natIp: string;
  context: BaseContext;
  verbose?: boolean;
}) {
  const process = Bun.spawnSync(["ping", "-q", "-w", "3", "-c", "1", natIp], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (verbose) {
    context.stdout.write(
      "testVpcNetworkBlocking STDOUT: " +
        (process.stdout?.toString() ?? "") +
        "\n"
    );
    context.stderr.write(
      "testVpcNetworkBlocking STDERR: " +
        (process.stderr?.toString() ?? "") +
        "\n"
    );
  }

  // If the output does not include "100% packet loss", then the network is not blocked
  if (!process.stdout.toString().includes("100% packet loss")) {
    context.stderr.write(pc.red(`Network traffic not blocked to ${natIp}!\n`));
    throw new Error(`Network traffic not blocked to ${natIp}!`);
  }
}
