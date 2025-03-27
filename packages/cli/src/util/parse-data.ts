import { z } from "zod";

// https://zod.dev/?id=inferring-the-inferred-type
export function parseData<T extends z.ZodTypeAny>(data: unknown, schema: T) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return schema.parse(data) as z.infer<T>;
}
