interface EnvironmentConfig {
  pf_stack_version?: string;
  sla_target?: number;
}

export function isEnvironmentConfig(
  value: unknown
): value is EnvironmentConfig {
  if (typeof value !== "object" || value === null) return false;

  // Check if the property exists, and if it does, ensure it's a string
  const config = value as Record<string, unknown>;
  return !(
    "pf_stack_version" in config &&
    typeof config["pf_stack_version"] !== "string"
  );
}
