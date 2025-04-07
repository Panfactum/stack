import { z } from "zod";

import constants from "./constants.json"

const ConstantsSchema = z.object({
    "versions": z.record(z.string(),
      z.object({
        ref: z.string(),
        placeholder: z.string(),
        slug: z.string(),
        label: z.string()
      })
    )
  })
  
export const CONSTANTS = ConstantsSchema.parse(constants)

export function replaceVersionPlaceholders(str: string) {
    let mutatedStr = str
    Object.values(CONSTANTS.versions).forEach((value) => {
      mutatedStr = mutatedStr.replaceAll(value.placeholder, value.ref)
    })
    return mutatedStr;
  }