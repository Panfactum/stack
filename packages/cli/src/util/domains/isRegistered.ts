import type { PanfactumContext } from "@/context/context";
import {resolveNs} from "node:dns/promises"

export async function isRegistered(inputs: {domain: string, context: PanfactumContext}){
    const {domain} = inputs;
    // TODO: This needs to be enhanced b/c the node dns system sucks and returns innaccurate results
    try {
        await resolveNs(domain)
        return true
    } catch {
        return false
    }
}