import { select, confirm as confirmPrompt } from "@inquirer/prompts";
import { Command } from "clipanion";
import pc from "picocolors";
import YAML from "yaml";
import { isPanfactumConfig } from "../util/is-panfactum-config";

// must check the region & run script to do that (NOT in global region)
// must ask for all the variables needed for the install and write them to a temp config file to read from throughout the install

export class InstallClusterCommand extends Command {
  static override paths = [["install-cluster"]];

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

    // Check if we're in the correct directory structure for cluster installation
    const currentDirectory = process.cwd();

    // Function to find panfactum.yaml by recursively looking up the directory tree
    const findPanfactumYaml = async (dir: string): Promise<string | null> => {
      const panfactumPath = `${dir}/panfactum.yaml`;
      if (await Bun.file(panfactumPath).exists()) {
        return panfactumPath;
      }

      const parentDir = dir.split("/").slice(0, -1).join("/");
      // Stop if we've reached the root directory
      if (parentDir === "" || parentDir === dir) {
        return null;
      }

      return findPanfactumYaml(parentDir);
    };

    const panfactumYamlPath = await findPanfactumYaml(currentDirectory);

    if (panfactumYamlPath === null) {
      this.context.stderr.write(
        pc.bgBlack(
          pc.red(
            "ERROR: Could not find panfactum.yaml in the current directory or any parent directory.\n"
          )
        )
      );
      return 1;
    }

    // Read and parse the panfactum.yaml file
    const panfactumYamlContent = await Bun.file(panfactumYamlPath).text();
    const panfactumConfig: unknown = YAML.parse(panfactumYamlContent);
    let environmentsDir: string | undefined;

    if (isPanfactumConfig(panfactumConfig)) {
      environmentsDir = panfactumConfig.environments_dir;
    }

    if (typeof environmentsDir !== "string") {
      this.context.stderr.write(
        pc.bgBlack(
          pc.red("ERROR: environments_dir not defined in panfactum.yaml.\n")
        )
      );
      return 1;
    }

    // Get the repo root directory (where panfactum.yaml is located)
    const repoRoot = panfactumYamlPath.substring(
      0,
      panfactumYamlPath.length - "panfactum.yaml".length - 1
    );
    const fullEnvironmentsPath = `${repoRoot}/${environmentsDir}`;

    // Check if we're in the correct directory structure
    if (!currentDirectory.startsWith(fullEnvironmentsPath)) {
      this.context.stderr.write(
        pc.bgBlack(
          pc.red(
            `ERROR: Cluster installation must be run from within a region-specific directory.\n`
          )
        )
      );
      this.context.stderr.write(
        pc.bgBlack(
          pc.red(
            `Please change to a directory like ${environmentsDir}/<environment>/<region> before continuing.\n`
          )
        )
      );
      return 1;
    }

    // Get the relative path from environments directory
    const relativePath = currentDirectory.substring(
      fullEnvironmentsPath.length + 1
    );
    const pathParts = relativePath.split("/");

    // Ensure we're at least two levels deep in the environments directory
    if (
      pathParts.length < 2 ||
      pathParts[0] === null ||
      pathParts[1] === null
    ) {
      this.context.stderr.write(
        pc.bgBlack(
          pc.red(
            `ERROR: Cluster installation must be run from at least two levels deep in the environments directory.\n`
          )
        )
      );
      this.context.stderr.write(
        pc.bgBlack(
          pc.red(
            `Please change to a directory like ${environmentsDir}/<environment>/<region> before continuing.\n`
          )
        )
      );
      return 1;
    }

    // Check if we're in a global directory
    if (pathParts[0].toLowerCase() === "global") {
      this.context.stderr.write(
        pc.bgBlack(
          pc.red(
            "ERROR: Cluster installation cannot be performed in a global directory.\n"
          )
        )
      );
      this.context.stderr.write(
        pc.bgBlack(
          pc.red(
            `Please change to a region-specific directory like ${environmentsDir}/<environment>/<region> before continuing.\n`
          )
        )
      );
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

    const answers = { slaTarget };

    // Warn about SLA target being difficult to change
    this.context.stdout.write(
      "\n\u26A0\uFE0F WARNING: SLA target affects your network architecture and is not easily changed later.\n"
    );
    this.context.stdout.write(
      "This determines how many availability zones your infrastructure will span.\n"
    );

    const proceed = await confirmPrompt({
      message: "Do you want to proceed with the installation?",
      default: true,
    });

    if (proceed === false) {
      this.context.stdout.write("Installation cancelled.\n");
      return 0;
    }

    // Write configuration to temp file
    const configPath = currentDirectory + "/.tmp-panfactum-install-config.json";
    await Bun.write(configPath, JSON.stringify(answers, null, 2));

    this.context.stdout.write(`Configuration saved to ${configPath}\n`);
    this.context.stdout.write("Starting AWS networking installation...\n");

    // Here we would call the actual installation process
    // This would include:
    // 1. Creating aws_vpc directory in the primary region
    // 2. Generating terragrunt.hcl with proper subnet configuration
    // 3. Running pf-tf-init and terragrunt apply
    // 4. Running pf-vpc-network-test to verify connectivity

    this.context.stdout.write(
      "To complete the installation, follow these steps:\n"
    );
    this.context.stdout.write(
      "1. Create a new `aws_vpc` directory in your primary region (not global)\n"
    );
    this.context.stdout.write(
      "2. Add a terragrunt.hcl with your subnet configuration\n"
    );
    this.context.stdout.write(
      "3. Run `pf-tf-init` to enable required providers\n"
    );
    this.context.stdout.write("4. Run `terragrunt apply`\n");
    this.context.stdout.write(
      "5. Verify your VPC configuration in the AWS console\n"
    );
    this.context.stdout.write(
      "6. Run `pf-vpc-network-test <path-to-aws_vpc-module>` to test connectivity\n"
    );

    return 0;
  }
}
