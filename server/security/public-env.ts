const SENSITIVE_PUBLIC_ENV_PATTERN = /(SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY|ACCESS_KEY)/i;

export function isSensitivePublicEnvName(name: string): boolean {
  return name.startsWith("VITE_") && SENSITIVE_PUBLIC_ENV_PATTERN.test(name);
}

export function assertNoSensitiveViteEnv(env: NodeJS.ProcessEnv = process.env): void {
  const exposed = Object.entries(env)
    .filter(([name, value]) => isSensitivePublicEnvName(name) && typeof value === "string" && value.trim())
    .map(([name]) => name)
    .sort();

  if (exposed.length === 0) {
    return;
  }

  throw new Error(
    `Sensitive client-exposed environment variables detected: ${exposed.join(", ")}. ` +
      "Do not expose secrets through VITE_* variables.",
  );
}
