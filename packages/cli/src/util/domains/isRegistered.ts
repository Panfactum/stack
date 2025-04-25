import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

/**
 * Note that this is more of a heuristic than an absolute truth as there isn't an easy-to-query
 * global database of registered domains.
 * 
 * As a proxy, we check if the domain has nameservers. Almost every purchased domain will have nameservers
 * configured as most registrars set this up by default.
 * 
 * In other words:
 *  - if this returns true, it is registerd
 *  - if this returns false, it is likely not registered (but it may be, so you should provide some escape
 *    hatch to allow the user to indicate that it is registered)
 * 
 * Additional notes:
 * 
 * - `domain` is expected to be an apex domain, and this function will not perform any checks for that
 */
export async function isRegistered(inputs: { domain: string, context: PanfactumContext }): Promise<boolean> {
    const { domain, context } = inputs;
    try {
        const result = await execute({
            command: ["dig", "+short", "NS", domain, "@1.1.1.1"],
            context,
            workingDirectory: process.cwd(),
            errorMessage: "Failed to execute dig command"
        });
        return result.stdout.trim() !== "";
    } catch {
        return false;
    }
}