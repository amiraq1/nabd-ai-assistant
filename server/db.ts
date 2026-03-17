import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";
import { getNodePgPoolConfig } from "./database-url.js";

export const pool = new pg.Pool(getNodePgPoolConfig());

export const db = drizzle(pool, { schema });
