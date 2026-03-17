import { createRepositories } from "./repositories/index.js";
import { ConversationDataService } from "./services/conversation-data-service.js";
import { ProjectDataService } from "./services/project-data-service.js";
import { db } from "../db.js";

export const repositories = createRepositories(db);

export const dataAccess = {
  repositories,
  conversations: new ConversationDataService(),
  projects: new ProjectDataService(),
};
