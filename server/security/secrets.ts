import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

export type SecretProvider = "env" | "aws-secrets-manager" | "vault";

export interface LoadedSecretsResult {
  provider: SecretProvider;
  loadedKeys: string[];
}

function parseJsonRecord(raw: string, context: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`${context} did not return valid JSON.`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${context} must resolve to a JSON object of key/value pairs.`);
  }

  const entries = Object.entries(parsed);
  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value === "string") {
      out[key] = value;
    } else if (value === null || value === undefined) {
      out[key] = "";
    } else {
      out[key] = JSON.stringify(value);
    }
  }

  return out;
}

function applySecrets(secretMap: Record<string, string>): string[] {
  const loadedKeys: string[] = [];

  for (const [key, value] of Object.entries(secretMap)) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
      loadedKeys.push(key);
    }
  }

  return loadedKeys.sort();
}

async function loadAwsSecretsManagerSecret(): Promise<Record<string, string>> {
  const secretId = process.env.AWS_SECRETS_MANAGER_SECRET_ID?.trim();
  if (!secretId) {
    throw new Error("AWS_SECRETS_MANAGER_SECRET_ID is required when SECRETS_PROVIDER=aws-secrets-manager.");
  }

  const region = process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim();
  const client = new SecretsManagerClient(region ? { region } : {});
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const secretString = response.SecretString?.trim();

  if (!secretString) {
    throw new Error("AWS Secrets Manager secret must be stored as SecretString JSON.");
  }

  return parseJsonRecord(secretString, `AWS Secrets Manager secret ${secretId}`);
}

async function authenticateVault(): Promise<string> {
  const roleId = process.env.VAULT_ROLE_ID?.trim();
  const secretId = process.env.VAULT_SECRET_ID?.trim();

  if (!roleId || !secretId) {
    throw new Error("VAULT_TOKEN or both VAULT_ROLE_ID and VAULT_SECRET_ID are required when SECRETS_PROVIDER=vault.");
  }

  const vaultAddr = process.env.VAULT_ADDR?.trim();
  if (!vaultAddr) {
    throw new Error("VAULT_ADDR is required when SECRETS_PROVIDER=vault.");
  }

  const namespace = process.env.VAULT_NAMESPACE?.trim();
  const response = await fetch(new URL("/v1/auth/approle/login", vaultAddr), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(namespace ? { "X-Vault-Namespace": namespace } : {}),
    },
    body: JSON.stringify({
      role_id: roleId,
      secret_id: secretId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Vault AppRole login failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    auth?: {
      client_token?: string;
    };
  };

  const token = payload.auth?.client_token?.trim();
  if (!token) {
    throw new Error("Vault AppRole login did not return a client token.");
  }

  return token;
}

async function loadVaultSecret(): Promise<Record<string, string>> {
  const vaultAddr = process.env.VAULT_ADDR?.trim();
  const kvPath = process.env.VAULT_KV_PATH?.trim();
  const namespace = process.env.VAULT_NAMESPACE?.trim();

  if (!vaultAddr) {
    throw new Error("VAULT_ADDR is required when SECRETS_PROVIDER=vault.");
  }

  if (!kvPath) {
    throw new Error("VAULT_KV_PATH is required when SECRETS_PROVIDER=vault.");
  }

  const token = process.env.VAULT_TOKEN?.trim() || (await authenticateVault());
  const response = await fetch(new URL(`/v1/${kvPath.replace(/^\/+/, "")}`, vaultAddr), {
    method: "GET",
    headers: {
      "X-Vault-Token": token,
      ...(namespace ? { "X-Vault-Namespace": namespace } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Vault secret read failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Record<string, unknown> & {
      data?: Record<string, unknown>;
    };
  };

  const rawSecret = payload.data?.data ?? payload.data;
  if (!rawSecret || typeof rawSecret !== "object" || Array.isArray(rawSecret)) {
    throw new Error("Vault secret payload must resolve to a key/value object.");
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawSecret)) {
    if (typeof value === "string") {
      out[key] = value;
    } else if (value === null || value === undefined) {
      out[key] = "";
    } else {
      out[key] = JSON.stringify(value);
    }
  }

  return out;
}

export async function loadConfiguredSecrets(): Promise<LoadedSecretsResult> {
  const provider = (process.env.SECRETS_PROVIDER?.trim().toLowerCase() || "env") as SecretProvider;

  if (provider === "env") {
    return {
      provider,
      loadedKeys: [],
    };
  }

  const secretMap =
    provider === "aws-secrets-manager"
      ? await loadAwsSecretsManagerSecret()
      : provider === "vault"
        ? await loadVaultSecret()
        : null;

  if (!secretMap) {
    throw new Error(
      `Unsupported SECRETS_PROVIDER "${process.env.SECRETS_PROVIDER}". ` +
        'Use "env", "aws-secrets-manager", or "vault".',
    );
  }

  return {
    provider,
    loadedKeys: applySecrets(secretMap),
  };
}
