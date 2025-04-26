import { z } from "zod"
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants"

export const ENVIRONMENT_NAME_SCHEMA = z
.string()
.min(3, "Environment names must be at least three characters")
.max(32, "Environment names must be no longer than 32 characters")
.regex(/^[a-z0-9-]+$/, "Environment names can only contain lowercase letters, numbers, and hyphens")
.refine(val => !val.includes('--'), "Environment names cannot contain consecutive hyphens")
.refine(val => !val.startsWith('-') && !val.endsWith('-'), "Environment names cannot start or end with a hyphen")
.refine(val => val !== MANAGEMENT_ENVIRONMENT, `'${MANAGEMENT_ENVIRONMENT}' is a reserved environment name`)
