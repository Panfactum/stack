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

  // TODO: What is the purpose of this check?
  if (needSlaTarget) {

  }

  return slaTarget;
}
