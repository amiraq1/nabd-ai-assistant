import { defineConfig } from "drizzle-kit";
import { getDrizzleKitPgCredentials } from "./server/database-url.ts";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: getDrizzleKitPgCredentials(),
});
