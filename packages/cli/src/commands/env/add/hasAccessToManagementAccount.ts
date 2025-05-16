import type { PanfactumContext } from "@/util/context/context";

export async function hasAccessToManagementAccount(context: PanfactumContext): Promise<void> {

  context.logger.info(`
    To allow Panfactum to properly configure your AWS Organization, you will need administrator access to your
    organization's management / root AWS account. Please log into the management account now.  
  `)

  while (true) {
    const confirmed = await context.logger.confirm({
      message: `Have you logged in?`,
      default: true
    });

    if (confirmed) {
      break
    } else {
      context.logger.error("You must login to the management account of your AWS organization to continue.")
    }
  }
}