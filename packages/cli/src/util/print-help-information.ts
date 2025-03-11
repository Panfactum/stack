import pc from "picocolors";
import type { BaseContext } from "clipanion";

export function printHelpInformation(context: BaseContext) {
  context.stdout.write(
    pc.black(
      pc.red(
        "If you need assistance, connect with us on our discord server: https://discord.gg/MJQ3WHktAS\n"
      )
    )
  );
  context.stdout.write(
    pc.black(
      pc.red(
        "If you think you've found a bug, please submit an issue: https://github.com/panfactum/panfactum/issues\n"
      )
    )
  );
}
