import open from "open";

export async function failsafeOpen(url: string) {
    try {
        open(url)
    } catch {
        // if open fails, don't fail the cli
    }
}