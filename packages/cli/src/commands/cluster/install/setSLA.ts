import { join } from "node:path";
import { select, confirm } from "@inquirer/prompts";
import pc from "picocolors";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import type { Checkpointer } from "./checkpointer";
import type { PanfactumContext } from "@/context/context";
import type { PANFACTUM_CONFIG_SCHEMA } from "@/util/config/schemas";
import type { z } from "zod";

type SlaTarget = z.infer<typeof PANFACTUM_CONFIG_SCHEMA.shape.sla_target>;

export async function setSLA(inputs: {
  checkpointer: Checkpointer;
  slaTarget: SlaTarget;
  context: PanfactumContext;
  environmentPath: string;
  clusterPath: string;
}): Promise<NonNullable<SlaTarget>> {
  const { slaTarget, context, environmentPath, clusterPath, checkpointer } =
    inputs;

  const savedSlaTarget = await checkpointer.getSavedInput("slaTarget");
  if (savedSlaTarget) {
    return savedSlaTarget as NonNullable<SlaTarget>;
  }

  let confirmedSLATarget: NonNullable<SlaTarget> = slaTarget ?? 3;
  let confirmed = false;
  if (slaTarget !== undefined) {
    context.logger.log(
      `⚠️ WARNING: This cluster is going to be deployed with SLA target set to ${slaTarget}. This CANNOT easily be changed later.`,
      { style: "warning", leadingNewlines: 2 }
    );
    confirmed = await confirm({
      message: pc.magenta("Do you want to proceed with this SLA target?"),
      default: true,
    });
  }

  if (!confirmed) {
    confirmedSLATarget = await select({
      message:
        pc.magenta(
          "Select your SLA target (affects high availability configuration). We recommend level 1 for test / development environments and level 2 or above for environments running live workloads.\n"
        ) + pc.red("Note that this CANNOT easily be changed later."),
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
  }

  if (slaTarget === undefined) {
    await upsertConfigValues({
      filePath: join(environmentPath, "environment.yaml"),
      values: {
        sla_target: confirmedSLATarget,
      },
    });
  } else if (slaTarget !== confirmedSLATarget) {
    await upsertConfigValues({
      filePath: join(clusterPath, "region.yaml"),
      values: {
        sla_target: confirmedSLATarget,
      },
    });
  }

  await checkpointer.updateSavedInput("slaTarget", confirmedSLATarget);

  return confirmedSLATarget;
}
