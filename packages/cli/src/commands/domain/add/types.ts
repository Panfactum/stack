import { z } from "zod";

export const DNS_ZONES_MODULE_OUTPUT_SCHEMA = z.object({
    zones: z.object({
        value: z.record(z.string(), z.object({
            zone_id: z.string(),
            name_servers: z.array(z.string())
        }))
    }),
    record_manager_role_arn: z.object({
        value: z.string()
    })
})