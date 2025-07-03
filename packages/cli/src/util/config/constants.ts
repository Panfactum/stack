/* Standard infrastructure configuration files. */
export const ENVIRONMENT_YAML = "environment.yaml";
export const REGION_YAML = "region.yaml";
export const GLOBAL_YAML = "global.yaml";
export const MODULE_YAML = "module.yaml";

/* Configuration file constants */
export const GLOBAL_CONFIG = "global.yaml";
export const GLOBAL_SECRETS_CONFIG = "global.secrets.yaml";
export const GLOBAL_USER_CONFIG = "global.user.yaml";
export const ENVIRONMENT_CONFIG = "environment.yaml";
export const ENVIRONMENT_SECRETS_CONFIG = "environment.secrets.yaml";
export const ENVIRONMENT_USER_CONFIG = "environment.user.yaml";
export const REGION_CONFIG = "region.yaml";
export const REGION_SECRETS_CONFIG = "region.secrets.yaml";
export const REGION_USER_CONFIG = "region.user.yaml";
export const MODULE_CONFIG = "module.yaml";
export const MODULE_SECRETS_CONFIG = "module.secrets.yaml";
export const MODULE_USER_CONFIG = "module.user.yaml";

/**
 * Configuration file search order
 * 
 * @remarks
 * WARNING: The order here is extremely important for proper precedence.
 * DO NOT CHANGE unless you know exactly what you are doing.
 * 
 * Files are processed in order, with later files overriding earlier ones:
 * 1. Global configs (shared across all environments)
 * 2. Environment configs (environment-specific overrides)
 * 3. Region configs (region-specific overrides)
 * 4. Module configs (module-specific overrides)
 * 
 * Within each level:
 * - Base config (.yaml) is loaded first
 * - Secrets (.secrets.yaml) override base
 * - User config (.user.yaml) overrides both
 */
export const CONFIG_FILE_PRECEDENCE = [
  GLOBAL_CONFIG,
  GLOBAL_SECRETS_CONFIG,
  GLOBAL_USER_CONFIG,
  ENVIRONMENT_CONFIG,
  ENVIRONMENT_SECRETS_CONFIG,
  ENVIRONMENT_USER_CONFIG,
  REGION_CONFIG,
  REGION_SECRETS_CONFIG,
  REGION_USER_CONFIG,
  MODULE_CONFIG,
  MODULE_SECRETS_CONFIG,
  MODULE_USER_CONFIG,
] as const;