import { ConversationRepository } from "./conversations-repository.js";
import { MessageRepository } from "./messages-repository.js";
import { ProjectRepository } from "./projects-repository.js";
import { UserRepository } from "./users-repository.js";
import type { DatabaseExecutor } from "../types.js";

export interface RepositorySet {
  users: UserRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
  projects: ProjectRepository;
}

export function createRepositories(executor: DatabaseExecutor): RepositorySet {
  return {
    users: new UserRepository(executor),
    conversations: new ConversationRepository(executor),
    messages: new MessageRepository(executor),
    projects: new ProjectRepository(executor),
  };
}
