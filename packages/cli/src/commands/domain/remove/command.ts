import { Command, Option } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";

export class DomainRemoveCommand extends PanfactumCommand {
    static override paths = [["domain", "remove"]];

    static override usage = Command.Usage({
        description: "Disconnects a domain from the Panfactum framework installation"
    });


    domain: string | undefined = Option.String("--domain,-d", {
        description: "The domain to add to the Panfactum installation",
        arity: 1
    });

    async execute() {
        throw new CLIError("Command not implemented.")
    }
}