import { Command, Option } from "clipanion";
import { getAWSProfiles } from "@/util/aws/getAWSProfiles";
import { PanfactumCommand } from "@/util/command/panfactumCommand";

export class AWSProfileListCommand extends PanfactumCommand {
    static override paths = [["aws", "profile", "list"]];
  
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
  
    async execute() {
      const profiles = await getAWSProfiles(this.context);
      
      const filteredProfiles = this.prefix 
        ? profiles.filter(profile => profile.startsWith(this.prefix as string))
        : profiles;
      
      filteredProfiles.forEach(profile => this.context.stdout.write(`${profile}\n`));
    }
  }
  