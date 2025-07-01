import { z } from "zod";
import { CLIError, PanfactumZodError } from "@/util/error/error";

export function parseJson<T>(schema: z.ZodType<T>, jsonString: string): T {
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new CLIError("Failed to parse JSON", error);
  }

  const parseResult = schema.safeParse(parsed);
  if (!parseResult.success) {
    throw new PanfactumZodError("Invalid JSON structure", "JSON input", parseResult.error);
  }
  
  return parseResult.data;
}