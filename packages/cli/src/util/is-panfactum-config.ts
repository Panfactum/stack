interface PanfactumConfig {
  environments_dir?: string;
}

export function isPanfactumConfig(value: unknown): value is PanfactumConfig {
  if (typeof value !== "object" || value === null) return false;

  // Check if the property exists, and if it does, ensure it's a string
  const config = value as Record<string, unknown>;
  return !(
    "environments_dir" in config &&
    typeof config["environments_dir"] !== "string"
  );
}
