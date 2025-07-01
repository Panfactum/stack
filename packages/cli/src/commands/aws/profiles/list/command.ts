// This command lists configured AWS profiles from the AWS config file
// It supports filtering profiles by prefix

import { Command, Option } from "clipanion";
import { getAWSProfiles } from "@/util/aws/getAWSProfiles";
import { PanfactumCommand } from "@/util/command/panfactumCommand";

/**
 * Command for listing configured AWS profiles
 * 
 * @remarks
 * This command reads and displays all AWS profiles configured in the
 * AWS config file (typically ~/.aws/config). It provides an easy way
 * to see available profiles for use with other AWS commands.
 * 
 * Key features:
 * - Lists all configured AWS profiles
 * - Optional prefix filtering for organization
 * - Reads from standard AWS config location
 * - Outputs one profile per line for scripting
 * 
 * The command is useful for:
 * - Discovering available AWS accounts
 * - Scripting profile selection
 * - Validating AWS configuration
 * - Troubleshooting authentication issues
 * 
 * @example
 * ```bash
 * # List all AWS profiles
 * pf aws profile list
 * 
 * # List only production profiles
 * pf aws profile list --prefix prod
 * 
 * # Use with other commands
 * pf aws profile list | grep staging
 * ```
 * 
 * @see {@link getAWSProfiles} - Utility for reading AWS profiles
 */
export class AWSProfileListCommand extends PanfactumCommand {
    static override paths = [["aws", "profile", "list"]];
  
    /**
     * Optional prefix to filter profiles by
     * 
     * @remarks
     * When provided, only profiles starting with this prefix will be shown.
     * This is useful for organizing profiles by environment or team.
     */
    prefix = Option.String("--prefix", {
      description: "Filter profiles by prefix",
      required: false,
    });

    static override usage = Command.Usage({
      description: "Returns the list of configured of AWS profiles",
      category: 'AWS',
      details:
        "Returns the list of configured AWS profiles in the config file inside your aws_dir.",
      examples: [
        ["List all AWS profiles", "pf aws profile list"],
        ["List AWS profiles with specific prefix", "pf aws profile list --prefix development"],
      ],
    });
  
    /**
     * Executes the profile list command
     * 
     * @remarks
     * Reads all AWS profiles from the configuration file and displays them.
     * If a prefix filter is provided, only matching profiles are shown.
     * Output is one profile per line for easy scripting integration.
     */
    async execute(): Promise<void> {
      const profiles = await getAWSProfiles(this.context);
      
      const filteredProfiles = this.prefix 
        ? profiles.filter(profile => profile.startsWith(this.prefix as string))
        : profiles;
      
      filteredProfiles.forEach(profile => this.context.stdout.write(`${profile}\n`));
    }
  }
  