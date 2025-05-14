import type { z } from "zod";

export function parseJson<T>(schema: z.ZodType<T>, jsonString: string): T {
  const parsed = JSON.parse(jsonString);

  return schema.parse(parsed);
}