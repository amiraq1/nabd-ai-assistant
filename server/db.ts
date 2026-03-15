import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";
import { getNodePgPoolConfig } from "./database-url.js";

const pool = new pg.Pool(getNodePgPoolConfig());

export const db = drizzle(pool, { schema });
