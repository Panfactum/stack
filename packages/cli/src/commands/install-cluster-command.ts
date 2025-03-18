import { appendFileSync } from "node:fs";
import path from "node:path";
import { Command, Option } from "clipanion";
import pc from "picocolors";
import { awsRegions } from "../util/aws-regions";
import { findPanfactumYaml } from "../util/find-panfactum-yaml";
import { printHelpInformation } from "../util/print-help-information";
import { setupEcrPullThroughCache } from "./aws/ecr-pull-through-cache";
import { setupEks } from "./aws/eks";
import { setupVpc } from "./aws/vpc";
import { userQAndA } from "./user-q-and-a";
import { replaceYamlValue } from "../util/replace-yaml-value";
import { getTerragruntVariables } from "../util/scripts/get-terragrunt-variables";
import { vpcNetworkTest } from "../util/scripts/vpc-network-test";

export class InstallClusterCommand extends Command {
  static override paths = [["install-cluster"]];

  verbose = Option.Boolean("-v,--verbose", {
    description: "Enable verbose output",
  });

  static override usage = Command.Usage({
    description: "Install a Panfactum cluster",
    details:
      "This command sets up a new Panfactum cluster including collecting configuration options and setting up all standard components.",
    examples: [["Start cluster installation", "pf install-cluster"]],
  });

  async execute(): Promise<number> {
    this.context.stdout.write(
      "Starting Panfactum cluster installation process...\n"
    );

    // Check if they're using the devShell
    if (this.context.env["PF_DEVSHELL"] !== "1") {
      this.context.stderr.write(
        pc.red(
          "ERROR: It appears you're not running this installer in the Panfactum devShell.\n" +
            "Please ensure you've completed the initial setup steps in the guide here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/installing-devshell#integrate-the-panfactum-devshell\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    // If there's no panfactum.yaml they need to complete the initial setup steps
    const currentDirectory = process.cwd();
    const panfactumYamlPath = await findPanfactumYaml(currentDirectory);
    if (panfactumYamlPath === null) {
      this.context.stderr.write(
        pc.red(
          "ERROR: Could not find panfactum.yaml in the current directory or any parent directory.\n" +
            "Please ensure you've completed the initial setup steps in the guide here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/installing-devshell#setting-repository-configuration-variables\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const terragruntVariables = await getTerragruntVariables({
      context: this.context,
    });

    this.context.stdout.write(
      `Terragrunt variables: ${JSON.stringify(terragruntVariables, null, 2)}\n`
    );

    const environmentsDir = terragruntVariables["environment"];
    // If the environments_dir set incorrectly in the panfactum.yaml file they need to complete the initial setup step
    if (
      typeof environmentsDir !== "string" &&
      typeof environmentsDir !== "number"
    ) {
      this.context.stderr.write(
        pc.red(
          "ERROR: environments_dir not defined in panfactum.yaml.\n" +
            "Please ensure you've set the required variables in the panfactum.yaml file:\n" +
            "https://panfactum.com/docs/edge/reference/configuration/repo-variables\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const environmentsDirString = String(environmentsDir);

    const validRegionsPattern = awsRegions.join("|");
    const pathRegex = new RegExp(
      `/${environmentsDirString}/(${validRegionsPattern})(?:/.*)?$`
    );
    const match = currentDirectory.match(pathRegex);

    if (!match) {
      this.context.stderr.write(
        pc.red(
          "ERROR: Cluster installation must be run from within a valid region-specific directory.\n" +
            `Please change to a directory like ${environmentsDirString}/<valid-aws-region> before continuing.\n` +
            `Valid AWS regions include: ${awsRegions.slice(0, 3).join(", ")}, and others.\n` +
            "If you do not have this file structure please ensure you've completed the initial setup steps here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#setting-up-your-repo\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const environment = terragruntVariables["environment"];
    // Check if the environment.yaml file exists
    if (typeof environment !== "string" && typeof environment !== "number") {
      this.context.stderr.write(
        pc.red(
          `ERROR: The environment.yaml appears to be malformed.\n` +
            "Please ensure your environment is properly configured by following the steps here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#configure-terragrunt-variables\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const pfStackVersion = terragruntVariables["pf_stack_version"];
    if (typeof pfStackVersion !== "string") {
      this.context.stderr.write(
        pc.red(
          "ERROR: pf_stack_version not defined.\n" +
            "Please ensure you've completed the initial setup steps in the guide here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#configure-terragrunt-variables\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const slaTarget = terragruntVariables["sla_target"];
    if (typeof slaTarget !== "number" || ![1, 2, 3].includes(slaTarget)) {
      this.context.stderr.write(
        pc.red(
          "ERROR: sla_target is not defined correctly in the environment.yaml.\n" +
            "Please ensure you've completed the initial setup steps in the guide here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/aws-networking#choose-your-sla-target\n"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const answers = await userQAndA({
      context: this.context,
      environment: String(environment),
      needSlaTarget: !slaTarget,
    });

    if (answers === 0) {
      return 0;
    }

    // Write configuration to temp file
    const configPath = path.join(
      currentDirectory,
      ".tmp-panfactum-install-config.json"
    );
    await Bun.write(configPath, JSON.stringify(answers, null, 2));

    this.context.stdout.write("Starting AWS networking installation...\n");

    try {
      if (!slaTarget) {
        // If sla_target doesn't exist, append it to the environment.yaml file
        appendFileSync(
          path.join(currentDirectory, "..", "environment.yaml"),
          `\n\n# SLA\nsla_target: ${answers.slaTarget || slaTarget}`
        );
      }
    } catch (error) {
      this.context.stderr.write(
        pc.red(
          `Error writing sla_target to environment.yaml: ${String(error)}\n`
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    this.context.stdout.write("Setting up the AWS VPC\n");

    try {
      await setupVpc({
        context: this.context,
        pfStackVersion,
        vpcName: answers.vpcName,
        vpcDescription: answers.vpcDescription,
        verbose: this.verbose,
      });
    } catch (error) {
      this.context.stderr.write(
        pc.red(`Error setting up the AWS VPC: ${String(error)}\n`)
      );
      printHelpInformation(this.context);
      return 1;
    }

    this.context.stdout.write("Running VPC network test...\n");

    try {
      await vpcNetworkTest({
        context: this.context,
        modulePath: path.join(currentDirectory, "..", "aws_vpc"),
        verbose: this.verbose,
      });
    } catch (error) {
      this.context.stderr.write(
        pc.red(`Error running VPC network test: ${String(error)}\n`)
      );
      printHelpInformation(this.context);
      return 1;
    }

    this.context.stdout.write("Setting up the AWS ECR pull through cache...\n");

    try {
      await setupEcrPullThroughCache({
        context: this.context,
        dockerHubUsername: answers.dockerHubUsername,
        githubUsername: answers.githubUsername,
        verbose: this.verbose,
      });
    } catch (error) {
      this.context.stderr.write(
        pc.red(
          `Error setting up the AWS ECR pull through cache: ${String(error)}\n`
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    try {
      await replaceYamlValue(
        "./region.yaml",
        "extra_inputs.pull_through_cache_enabled",
        true
      );
    } catch (error) {
      this.context.stderr.write(
        pc.red(
          `Error updating region.yaml to enable the AWS ECR pull through cache: ${String(error)}\n`
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    this.context.stdout.write("Setting up the AWS EKS cluster...\n");
    this.context.stdout.write(
      pc.bold("NOTE: This may take up to 20 minutes to complete.\n")
    );

    try {
      await setupEks({
        context: this.context,
        clusterName: answers.clusterName,
        clusterDescription: answers.clusterDescription,
        slaLevel: answers.slaTarget || (slaTarget as 1 | 2 | 3), // This is validated in the code earlier
        verbose: this.verbose,
      });
    } catch (error) {
      this.context.stderr.write(
        pc.red(`Error setting up the AWS EKS cluster: ${String(error)}\n`)
      );
      printHelpInformation(this.context);
      return 1;
    }

    return 0;
  }
}
