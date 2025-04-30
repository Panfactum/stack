import { execute } from "../subprocess/execute";
import type { PanfactumContext } from "@/context/context";

/**
 * Note that this is more of a heuristic than an absolute truth as there isn't a realtime updated
 * global database of registered domains.
 * 
 * As a proxy, we check if the domain has nameservers. Almost every purchased domain will have nameservers
 * configured as most registrars set this up by default.
 * 
 * If there are no nameservers, we check the whois database which can be 24-72 hours out-of-date to determine
 * if the domain has been registered but has no / invalid NS records.
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

    // First: If the domain has nameservers, it is definitely registered.
    try {
        const result = await execute({
            command: ["dig", "+short", "NS", domain, "@1.1.1.1"],
            context,
            workingDirectory: process.cwd(),
            errorMessage: "Failed to execute dig command"
        });
        if (result.stdout.trim() !== "") {
            return true;
        }
    } catch {
        // Ignore
    }

    // Second: Search the whois database (which might be outdated)
    try {
        const result = await execute({
            command: ["whois", domain],
            context,
            workingDirectory: process.cwd(),
            errorMessage: "Failed to execute whois command"
        });
        return result.stdout.includes(`Domain Name: ${domain}`)
    } catch {
        return false;
    }

}