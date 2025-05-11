import { z } from "zod"

export const INIT_STATUS_SCHEMA = z.enum(["uninited", "running", "success", "error"])
export const DEPLOY_STATUS_SCHEMA = z.enum(["undeployed", "running", "success", "error"])
export const MODULE_STATUS_FILE_SCHEMA = z.object({
    init_status: INIT_STATUS_SCHEMA.default("uninited"),
    deploy_status: DEPLOY_STATUS_SCHEMA.default("undeployed")
}).strict()
