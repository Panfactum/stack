import { confirm, select } from "@inquirer/prompts";
import pc from "picocolors";
import type { BaseContext } from "clipanion";

export async function slaPrompts({
  context,
  needSlaTarget,
}: {
  context: BaseContext;
  needSlaTarget: boolean;
}) {
  // https://panfactum.com/docs/edge/guides/bootstrapping/aws-networking#choose-your-sla-target
  let slaTarget: 1 | 2 | 3 | undefined;
  if (needSlaTarget) {
    slaTarget = await select({
      message: pc.magenta(
        "Select your SLA target (affects high availability configuration). We recommend level 1 for test / development environments and level 2 or above for environments running live workloads."
      ),
      choices: [
        {
          name: "Level 1: 99.9% uptime (< 45 minutes of downtime / month) — Lowest cost",
          value: 1,
        },
        {
          name: "Level 2: 99.99% uptime (< 5 minutes of downtime / month) — Roughly 2x the cost of level 1",
          value: 2,
        },
        {
          name: "Level 3: 99.999% uptime (< 30 seconds of downtime / month) — Roughly 1.5x the cost of level 2",
          value: 3,
        },
      ],
      default: 3,
    });

    // Warn about SLA target being difficult to change
    context.stdout.write(
      pc.red(
        "\n⚠️ WARNING: SLA target affects your network architecture and is not easily changed later.\n"
      )
    );
    context.stdout.write(
      pc.red(
        "This determines how many availability zones your infrastructure will span.\n"
      )
    );

    const proceed = await confirm({
      message: pc.magenta("Do you want to proceed with the installation?"),
      default: true,
    });

    if (proceed === false) {
      context.stdout.write("Installation cancelled.\n");
      return 0;
    }
  }

  return slaTarget;
}
