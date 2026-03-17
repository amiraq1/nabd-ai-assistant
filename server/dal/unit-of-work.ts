import { db } from "../db.js";
import { createRepositories, type RepositorySet } from "./repositories/index.js";

export interface UnitOfWorkContext extends RepositorySet {
  afterCommit(task: () => Promise<void> | void): void;
}

export interface IUnitOfWork {
  execute<T>(work: (context: UnitOfWorkContext) => Promise<T>): Promise<T>;
}

export class DrizzleUnitOfWork implements IUnitOfWork {
  async execute<T>(work: (context: UnitOfWorkContext) => Promise<T>): Promise<T> {
    const { result, afterCommitTasks } = await db.transaction(async (tx) => {
      const repositories = createRepositories(tx);
      const afterCommitTasks: Array<() => Promise<void> | void> = [];

      const result = await work({
        ...repositories,
        afterCommit(task) {
          afterCommitTasks.push(task);
        },
      });

      return {
        result,
        afterCommitTasks,
      };
    });

    for (const task of afterCommitTasks) {
      await task();
    }

    return result;
  }
}
