import { db } from "../db.js";

export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DatabaseExecutor = typeof db | DatabaseTransaction;
