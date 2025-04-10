import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

/**
 * Tests if network traffic to a specified NAT IP address is blocked.
 *
 * This function attempts to ping the provided NAT IP address and checks
 * if all packets are lost, which indicates that network traffic is properly blocked.
 * If any packets get through, it throws an error indicating that the network
 * is not properly blocked.
 */
export async function testVPCNetworkBlocking({
  natIp,
  context
}: {
  natIp: string;
  context: PanfactumContext;
}) {

  await execute({
    command: ["ping", "-q", "-w", "3", "-c", "1", natIp],
    context,
    workingDirectory: process.cwd(),
    errorMessage: `Network traffic not blocked to ${natIp}!`,
    isSuccess: ({stdout}) => stdout.includes("100% packet loss") // TODO: verify this
  })
  return true
}
