import { readFileSync } from "node:fs";
import * as pc from "picocolors";
import type { BaseContext } from "clipanion";

/**
 * Extracts Route53 zone keys from a Terragrunt HCL file
 *
 * This function parses an HCL file to extract the keys from a route53_zones object.
 * It's primarily used to extract zone information from the kube_cert_issuers configuration.
 *
 * @param options - Function options
 * @param options.filePath - Path to the HCL file containing route53_zones configuration
 * @param options.context - Clipanion context for logging errors and warnings
 * @returns An array of Route53 zone keys found in the HCL file, or empty array if none found or on error
 */
export function extractRoute53ZoneKeys({
  filePath,
  context,
}: {
  filePath: string;
  context: BaseContext;
}): string[] {
  try {
    // Read file contents
    const fileContent = readFileSync(filePath, "utf-8");

    // Find the route53_zones section using a more robust approach
    // First find the line with route53_zones
    const route53ZonesLine = fileContent.match(/route53_zones\s*=\s*{/);
    if (!route53ZonesLine) {
      context.stderr.write(
        pc.red("No route53_zones section found in the file")
      );
      return [];
    }

    // Extract all quoted keys in the file
    const keyRegex = /"([^"]+)"\s*=(?:\s*{|\s*=\s*{)/g;
    const keys: string[] = [];
    let keyMatch;

    // Create a substring from the route53_zones section to the end
    const startIndex = fileContent.indexOf("route53_zones");
    const relevantContent = fileContent.substring(startIndex);

    // Find the closing brace of the route53_zones block
    let braceCount = 0;
    let endIndex = 0;
    let foundOpeningBrace = false;

    for (let i = 0; i < relevantContent.length; i++) {
      const char = relevantContent[i];

      if (char === "{") {
        foundOpeningBrace = true;
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (foundOpeningBrace && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    // Get just the route53_zones block
    const zonesBlock = relevantContent.substring(0, endIndex);

    // Extract keys from the properly extracted zone block
    while ((keyMatch = keyRegex.exec(zonesBlock)) !== null) {
      keys.push(keyMatch[1] ?? "");
    }

    return keys;
  } catch (error) {
    context.stderr.write(
      pc.red(
        `Error processing file: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    return [];
  }
}
