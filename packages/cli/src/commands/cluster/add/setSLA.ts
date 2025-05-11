import { getConfigValuesFromFile } from "@/util/config/getConfigValuesFromFile";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import type { PANFACTUM_CONFIG_SCHEMA } from "@/util/config/schemas";
import type { PanfactumContext } from "@/util/context/context";
import type { z } from "zod";

type SlaTarget = z.infer<typeof PANFACTUM_CONFIG_SCHEMA.shape.sla_target>;

export async function setSLA(inputs: {
  slaTarget: SlaTarget;
  context: PanfactumContext;
  environment: string;
  region: string;
}): Promise<NonNullable<SlaTarget>> {
  const { slaTarget, context, environment, region } = inputs;

  const regionConfig = await getConfigValuesFromFile({
    environment,
    region,
    context
  });

  if (regionConfig?.sla_target) {
    return regionConfig.sla_target as NonNullable<SlaTarget>;
  }

  let confirmedSLATarget: NonNullable<SlaTarget> = slaTarget ?? 3;
  let confirmed = false;
  if (slaTarget !== undefined) {
    confirmed = await context.logger.confirm({
      explainer: {
        message: `
        This cluster is going to be deployed with SLA target set to ${slaTarget}. This CANNOT easily be changed later.
      `,
        highlights: [String(slaTarget)]
      },
      message: { message: `Do you want to proceed with SLA ${slaTarget}?`, highlights: [String(slaTarget)] }
    });
  }

  if (!confirmed) {
    confirmedSLATarget = await context.logger.select({
      explainer: {
        message: `
          Select your SLA target (affects high availability configuration).
          We recommend level 1 for test / development environments and level 2 or above for environments running live workloads.

          Note that this CANNOT easily be changed later.
        `,
        highlights: ["CANNOT"]
      },
      message: "Level:",
      choices: [
        {
          name: context.logger.applyColors("Level 1 99.9% uptime — Lowest cost", { lowlights: ["99.9% uptime — Lowest cost"] }),
          value: 1,
        },
        {
          name: context.logger.applyColors("Level 2 99.99% uptime — Roughly 2x the cost of level 1", { lowlights: ["99.99% uptime — Roughly 2x the cost of level 1"] }),
          value: 2,
        },
        {
          name: context.logger.applyColors("Level 3 99.999% uptime — Roughly 1.5x the cost of level 2", { lowlights: ["99.999% uptime — Roughly 1.5x the cost of level 2"] }),
          value: 3,
        },
      ],
      default: 3,
    });
  }

  // TODO: @seth set in the environment.yaml if not already set there
  await upsertConfigValues({
    environment,
    region,
    values: {
      sla_target: confirmedSLATarget,
    },
    context,
  });

  return confirmedSLATarget;
}
