import { appendFileSync } from "node:fs";
import { dirname } from "path";
import { select, confirm, input } from "@inquirer/prompts";
import { Command, Option } from "clipanion";
import pc from "picocolors";
import YAML from "yaml";
import { awsRegions } from "../util/aws-regions";
import { findPanfactumYaml } from "../util/find-panfactum-yaml";
import { isEnvironmentConfig } from "../util/is-environment-config";
import { isPanfactumConfig } from "../util/is-panfactum-config";
import { printHelpInformation } from "../util/print-help-information";
import { setupVpc } from "./aws/vpc";

const BOOTSTRAP_GUIDE_URL =
  "https://panfactum.com/docs/edge/guides/bootstrapping/overview\n";

export class InstallClusterCommand extends Command {
  static override paths = [["install-cluster"]];

  verbose = Option.Boolean("-v,-verbose", {
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

    // If there's no panfactum.yaml they need to complete the initial setup steps
    const currentDirectory = process.cwd();
    const panfactumYamlPath = await findPanfactumYaml(currentDirectory);
    if (panfactumYamlPath === null) {
      this.context.stderr.write(
        pc.red(
          "ERROR: Could not find panfactum.yaml in the current directory or any parent directory.\n" +
            "Please ensure you've completed the initial setup steps in the guide here:\n" +
            "https://panfactum.com/docs/edge/guides/bootstrapping/installing-devshell#setting-repository-configuration-variables"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    // If the environments_dir is not set in the panfactum.yaml file they need to complete the initial setup steps
    const panfactumYamlContent = await Bun.file(panfactumYamlPath).text();
    const panfactumConfig: unknown = YAML.parse(panfactumYamlContent);
    let environmentsDir: string | number | undefined;
    if (isPanfactumConfig(panfactumConfig)) {
      environmentsDir = panfactumConfig.environments_dir;
    }

    if (typeof environmentsDir !== "string" || typeof environmentsDir !== "number") {
      this.context.stderr.write(
        pc.red(
          "ERROR: environments_dir not defined in panfactum.yaml.\n" +
            "Please ensure you've set the required variables in the panfactum.yaml file:\n" +
            "https://panfactum.com/docs/edge/reference/configuration/repo-variables"
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    const environmentsDirString = String(environmentsDir);

    const validRegionsPattern = awsRegions.join("|");
    const pathRegex = new RegExp(
      `/${environmentsDirString}/([^/]+)/(${validRegionsPattern})(?:/.*)?$`
    );
    const match = currentDirectory.match(pathRegex);

    if (!match) {
      this.context.stderr.write(
        pc.red(
          "ERROR: Cluster installation must be run from within a valid region-specific directory.\n" +
            `Please change to a directory like ${environmentsDirString}/<environment>/<valid-aws-region> before continuing.\n` +
            `Valid AWS regions include: ${awsRegions.slice(0, 3).join(", ")}, and others.\n` +
            "If you do not have this file structure please ensure you've completed the initial setup steps here:\n" +
            BOOTSTRAP_GUIDE_URL
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    // Collect required information
    const slaTarget = await select({
      message:
        "Select your SLA target (affects high availability configuration). We recommend level 1 for test / development environments and level 2 or above for environments running live workloads.",
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

    // Extract environment from the path
    const environment = match[1];
    // Construct the path to the environment.yaml file
    const environmentYamlPath = `${dirname(panfactumYamlPath)}/${environmentsDirString}/${environment}/environment.yaml`;
    // Check if the environment.yaml file exists
    if (!(await Bun.file(environmentYamlPath).exists())) {
      this.context.stderr.write(
        pc.red(
          `ERROR: Could not find environment.yaml file at ${environmentYamlPath}.\n` +
            "Please ensure your environment is properly configured.\n" +
            "If you do not have this file structure please ensure you've completed the initial setup steps here:\n" +
            BOOTSTRAP_GUIDE_URL
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    // Read and parse the environment.yaml file using YAML package
    const environmentYamlContent = await Bun.file(environmentYamlPath).text();
    const environmentConfig: unknown = YAML.parse(environmentYamlContent);

    let pfStackVersion: string | undefined;
    if (isEnvironmentConfig(environmentConfig)) {
      pfStackVersion = environmentConfig.pf_stack_version;
    }

    if (typeof pfStackVersion !== "string") {
      this.context.stderr.write(
        pc.red(
          "ERROR: pf_stack_version not defined in environment.yaml.\n" +
            "Please ensure you've completed the initial setup steps in the guide here:\n" +
            BOOTSTRAP_GUIDE_URL
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    // Warn about SLA target being difficult to change
    this.context.stdout.write(
      "\n\u26A0\uFE0F WARNING: SLA target affects your network architecture and is not easily changed later.\n"
    );
    this.context.stdout.write(
      "This determines how many availability zones your infrastructure will span.\n"
    );

    const proceed = await confirm({
      message: "Do you want to proceed with the installation?",
      default: true,
    });

    if (proceed === false) {
      this.context.stdout.write("Installation cancelled.\n");
      return 0;
    }

    // Prompt for VPC name
    const vpcName = await input({
      message: "Enter a name for your VPC:",
      default: `panfactum-${environment}`,
    });

    // Prompt for VPC description
    const vpcDescription = await input({
      message: "Enter a description for your VPC:",
      default: `Panfactum VPC for the ${environment} environment`,
    });

    const answers = { pfStackVersion, slaTarget, vpcName, vpcDescription };

    // Write configuration to temp file
    const configPath = currentDirectory + "/.tmp-panfactum-install-config.json";
    await Bun.write(configPath, JSON.stringify(answers, null, 2));

    this.context.stdout.write("Starting AWS networking installation...\n");

    // Check if sla_target exists in the environment.yaml file and handle accordingly
    try {
      const parsedEnvironmentConfig: Record<string, unknown> = YAML.parse(
        environmentYamlContent
      );

      if ("sla_target" in parsedEnvironmentConfig) {
        // If sla_target exists but is different from the chosen value
        if (parsedEnvironmentConfig["sla_target"] !== slaTarget) {
          this.context.stderr.write(
            pc.red(
              `ERROR: The environment.yaml file already has an SLA target of ${String(parsedEnvironmentConfig["sla_target"])}, ` +
                `which is different from the chosen value of ${slaTarget}.\n` +
                `Changing the SLA target requires network architecture changes and is not supported through this command.`
            )
          );
          printHelpInformation(this.context);
          return 1;
        }
        // If sla_target exists and matches the chosen value, do nothing
      } else {
        // If sla_target doesn't exist, append it to the file
        appendFileSync(
          environmentYamlPath,
          `\n\n# SLA\nsla_target: ${slaTarget}`
        );
      }
    } catch (error) {
      this.context.stderr.write(
        pc.red(
          `Error handling sla_target in environment.yaml: ${String(error)}`
        )
      );
      printHelpInformation(this.context);
      return 1;
    }

    this.context.stdout.write("Setting up the AWS VPC\n");

    try {
      await setupVpc({
        context: this.context,
        vpcName: answers.vpcName,
        vpcDescription: answers.vpcDescription,
        verbose: this.verbose,
      });
    } catch (error) {
      this.context.stderr.write(
        pc.red(`Error setting up the AWS VPC: ${String(error)}`)
      );
      printHelpInformation(this.context);
      return 1;
    }

    return 0;
  }
}
