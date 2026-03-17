import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import pg from "pg";
import { getNodePgPoolConfig, hasDatabaseUrl } from "../server/database-url.js";

const MIGRATION_TABLE = "app_schema_migrations";
const MIGRATION_LOCK_ID = 8_301_167;

interface AppliedMigrationRow {
  id: string;
  checksum: string;
}

async function main(): Promise<void> {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required to apply safe SQL migrations.");
  }

  const migrationsDirectory = path.resolve(process.cwd(), "migrations");
  const migrationFiles = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (migrationFiles.length === 0) {
    console.log("No SQL migrations found.");
    return;
  }

  const pool = new pg.Pool(getNodePgPoolConfig());
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        id text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const appliedRows = await client.query<AppliedMigrationRow>(
      `SELECT id, checksum FROM ${MIGRATION_TABLE}`,
    );
    const appliedMigrations = new Map(
      appliedRows.rows.map((row) => [row.id, row.checksum]),
    );

    for (const file of migrationFiles) {
      const fullPath = path.join(migrationsDirectory, file);
      const sql = await fs.readFile(fullPath, "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const appliedChecksum = appliedMigrations.get(file);

      if (appliedChecksum) {
        if (appliedChecksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch for ${file}. Refusing to continue.`,
          );
        }

        console.log(`skip ${file}`);
        continue;
      }

      console.log(`apply ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${MIGRATION_TABLE} (id, checksum) VALUES ($1, $2)`,
          [file, checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {
      // Ignore unlock failures during shutdown.
    });
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[db:migrate]", error);
  process.exitCode = 1;
});
