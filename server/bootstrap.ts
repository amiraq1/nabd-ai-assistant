import "./load-env.js";
import { assertNoSensitiveViteEnv } from "./security/public-env.js";
import { loadConfiguredSecrets } from "./security/secrets.js";

let bootstrapPromise: Promise<void> | null = null;

export async function bootstrapRuntime(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const result = await loadConfiguredSecrets();
      assertNoSensitiveViteEnv();

      if (result.provider !== "env") {
        const loaded = result.loadedKeys.length > 0 ? result.loadedKeys.join(", ") : "none";
        console.log(`[security] loaded secrets from ${result.provider}: ${loaded}`);
      }
    })();
  }

  await bootstrapPromise;
}
