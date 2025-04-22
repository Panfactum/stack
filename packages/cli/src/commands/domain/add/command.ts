import { search } from "@inquirer/prompts";
import { Command } from "clipanion";
import { applyColors } from "@/util/colors/applyColors";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getEnvironments } from "@/util/config/getEnvironments";
import { CLIError } from "@/util/error/error";
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";


export class DomainsAddCommand extends PanfactumCommand {
    static override paths = [["domain", "add"]];

    static override usage = Command.Usage({
        description: "Add a domain to an environment",
        details:
            "Executes a guided installation of a domain to an environment",
    });

    async execute() {
        const {context} = this

        /////////////////////////////////////////////////////////////////////////
        // Choose environment to install the domain into
        /////////////////////////////////////////////////////////////////////////

        const environments = await getEnvironments(context)
        const possibleEnvironment = environments.filter(({name}) => name !== MANAGEMENT_ENVIRONMENT)

        if(possibleEnvironment.length === 0){
            if(environments.length === 0){
                throw new CLIError('Cannot add a domain until you have installed an environment to host the domain. Run `pf env install` to create an environment.')
            }else {
                throw new CLIError('You only have a management environment which cannot be used to host domains. Run `pf env install` to create an additional environment.')
            }
        }

        let environment: string;
        if(possibleEnvironment.length === 1){
            environment = possibleEnvironment[0]?.name!
            const confirmEnvironment = confirm(
                applyColors(`You only have one environment (${environment}). Would you like to use this environment to host the DNS servers for this domain?`, {highlights: [environment]})
            )
            if (!confirmEnvironment){
                throw new CLIError(`Declined to host domain in ${environment}. Create a new environment to host the domain by running \`pf env install\``)
            }
        } else {
            context.logger.log(
                `In which environment would you like to host the DNS servers for this domain?\n` +
                {trailingNewlines: 1, leadingNewlines: 1}
            )

            const environment = search({
                message: "Environment:",
                source: (term) => {
                    return term ? possibleEnvironment.map(({name}) => name).filter(name => name.includes(term)) : possibleEnvironment.map(({name}) => name)
                }
            })
    
        }

        /////////////////////////////////////////////////////////////////////////
        // Choose type of install
        /////////////////////////////////////////////////////////////////////////

        context.logger.log(
            `How would you like to add to the domain?\n` +
            {trailingNewlines: 1, leadingNewlines: 1}
        )

        // const method:  = select({
        //     message: "Environment:",
        //     source: (term) => {
        //         return term ? possibleEnvironment.map(({name}) => name).filter(name => name.includes(term)) : possibleEnvironment.map(({name}) => name)
        //     }
        // })


    }
}


