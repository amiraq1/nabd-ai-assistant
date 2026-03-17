import {
  type User,
  type InsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Project,
  type InsertProject,
  type ProjectScreen,
  type InsertProjectScreen,
} from "../shared/schema.js";
import { hasDatabaseUrl } from "./database-url.js";
import { randomUUID } from "crypto";
import { dataAccess } from "./dal/index.js";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  ensureSessionUser(userId: string): Promise<User>;
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string, userId: string): Promise<Conversation | undefined>;
  createConversation(conv: InsertConversation): Promise<Conversation>;
  deleteConversation(id: string, userId: string): Promise<boolean>;
  getMessages(conversationId: string, userId: string): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  getProjectByName(userId: string, name: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;
  updateProjectName(id: string, name: string): Promise<Project | undefined>;
  ensureProject(userId: string, name: string, platform: Project["platform"]): Promise<Project>;
  createProjectScreen(screen: InsertProjectScreen): Promise<ProjectScreen>;
  getProjectScreen(screenId: string): Promise<ProjectScreen | undefined>;
  getLatestProjectScreen(projectId: string): Promise<ProjectScreen | undefined>;
  updateProjectScreen(
    screenId: string,
    updates: {
      name?: string;
      uiSchema?: InsertProjectScreen["uiSchema"];
      reactCode?: string;
    },
  ): Promise<ProjectScreen | undefined>;
  updateProjectScreenReactCode(
    screenId: string,
    reactCode: string,
  ): Promise<ProjectScreen | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return dataAccess.repositories.users.findById(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return dataAccess.repositories.users.findByUsername(username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return dataAccess.repositories.users.create(insertUser);
  }

  async ensureSessionUser(userId: string): Promise<User> {
    return dataAccess.repositories.users.ensureSessionUser(userId);
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const page = await dataAccess.conversations.listConversationsForUser(userId, {
      limit: 100,
    });
    return page.items;
  }

  async getConversation(id: string, userId: string): Promise<Conversation | undefined> {
    return dataAccess.conversations.getConversationForUser(id, userId);
  }

  async createConversation(conv: InsertConversation): Promise<Conversation> {
    return dataAccess.conversations.createConversation(conv.userId, conv.title);
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    return dataAccess.conversations.deleteConversation(id, userId);
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    return dataAccess.conversations.listMessagesForConversation(conversationId, userId);
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    return dataAccess.conversations.createMessage(msg);
  }

  async getProjects(): Promise<Project[]> {
    return dataAccess.repositories.projects.listAll(200);
  }

  async getProject(id: string): Promise<Project | undefined> {
    return dataAccess.repositories.projects.findById(id);
  }

  async getProjectByName(userId: string, name: string): Promise<Project | undefined> {
    return dataAccess.repositories.projects.findByNameForUser(userId, name);
  }

  async createProject(project: InsertProject): Promise<Project> {
    return dataAccess.repositories.projects.create(project);
  }

  async deleteProject(id: string): Promise<boolean> {
    return dataAccess.repositories.projects.deleteById(id);
  }

  async updateProjectName(id: string, name: string): Promise<Project | undefined> {
    return dataAccess.repositories.projects.updateName(id, name);
  }

  async ensureProject(
    userId: string,
    name: string,
    platform: Project["platform"],
  ): Promise<Project> {
    return dataAccess.projects.ensureNamedProject({ userId, name, platform });
  }

  async createProjectScreen(screen: InsertProjectScreen): Promise<ProjectScreen> {
    return dataAccess.repositories.projects.createScreen(screen);
  }

  async getProjectScreen(screenId: string): Promise<ProjectScreen | undefined> {
    return dataAccess.repositories.projects.findScreenById(screenId);
  }

  async getLatestProjectScreen(projectId: string): Promise<ProjectScreen | undefined> {
    return dataAccess.repositories.projects.findLatestScreenByProject(projectId);
  }

  async updateProjectScreen(
    screenId: string,
    updates: {
      name?: string;
      uiSchema?: InsertProjectScreen["uiSchema"];
      reactCode?: string;
    },
  ): Promise<ProjectScreen | undefined> {
    return dataAccess.repositories.projects.updateScreen(screenId, updates);
  }

  async updateProjectScreenReactCode(
    screenId: string,
    reactCode: string,
  ): Promise<ProjectScreen | undefined> {
    return this.updateProjectScreen(screenId, { reactCode });
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message> = new Map();
  private projects: Map<string, Project> = new Map();
  private projectScreens: Map<string, ProjectScreen> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async ensureSessionUser(userId: string): Promise<User> {
    const existing = this.users.get(userId);
    if (existing) {
      return existing;
    }

    const user: User = {
      id: userId,
      username: `session_${userId}`,
      password: randomUUID(),
    };
    this.users.set(userId, user);
    return user;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    ).filter(
      (conversation) => conversation.userId === userId,
    );
  }

  async getConversation(id: string, userId: string): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation || conversation.userId !== userId) return undefined;
    return conversation;
  }

  async createConversation(conv: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      ...conv,
      id,
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const conversation = await this.getConversation(id, userId);
    if (!conversation) return false;

    this.conversations.delete(id);
    for (const [msgId, msg] of Array.from(this.messages.entries())) {
      if (msg.conversationId === id) {
        this.messages.delete(msgId);
      }
    }
    return true;
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) return [];

    return Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...msg,
      id,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectByName(userId: string, name: string): Promise<Project | undefined> {
    return Array.from(this.projects.values())
      .filter((project) => project.userId === userId && project.name === name)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = randomUUID();
    const createdProject: Project = {
      ...project,
      id,
      createdAt: new Date(),
    };
    this.projects.set(id, createdProject);
    return createdProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project) {
      return false;
    }

    this.projects.delete(id);
    for (const [screenId, screen] of Array.from(this.projectScreens.entries())) {
      if (screen.projectId === id) {
        this.projectScreens.delete(screenId);
      }
    }

    return true;
  }

  async updateProjectName(id: string, name: string): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) {
      return undefined;
    }

    const updatedProject: Project = {
      ...project,
      name,
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async ensureProject(
    userId: string,
    name: string,
    platform: Project["platform"],
  ): Promise<Project> {
    const existing = await this.getProjectByName(userId, name);
    if (existing) {
      return existing;
    }

    return this.createProject({ userId, name, platform });
  }

  async createProjectScreen(screen: InsertProjectScreen): Promise<ProjectScreen> {
    const id = randomUUID();
    const createdScreen: ProjectScreen = {
      ...screen,
      id,
      reactCode: screen.reactCode ?? "",
      updatedAt: new Date(),
    };
    this.projectScreens.set(id, createdScreen);
    return createdScreen;
  }

  async getProjectScreen(screenId: string): Promise<ProjectScreen | undefined> {
    return this.projectScreens.get(screenId);
  }

  async getLatestProjectScreen(projectId: string): Promise<ProjectScreen | undefined> {
    return Array.from(this.projectScreens.values())
      .filter((screen) => screen.projectId === projectId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }

  async updateProjectScreen(
    screenId: string,
    updates: {
      name?: string;
      uiSchema?: InsertProjectScreen["uiSchema"];
      reactCode?: string;
    },
  ): Promise<ProjectScreen | undefined> {
    const screen = this.projectScreens.get(screenId);
    if (!screen) {
      return undefined;
    }

    const updatedScreen: ProjectScreen = {
      ...screen,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.uiSchema !== undefined ? { uiSchema: updates.uiSchema } : {}),
      ...(updates.reactCode !== undefined ? { reactCode: updates.reactCode } : {}),
      updatedAt: new Date(),
    };
    this.projectScreens.set(screenId, updatedScreen);
    return updatedScreen;
  }

  async updateProjectScreenReactCode(
    screenId: string,
    reactCode: string,
  ): Promise<ProjectScreen | undefined> {
    return this.updateProjectScreen(screenId, { reactCode });
  }
}

export const storage = hasDatabaseUrl()
  ? new DatabaseStorage()
  : new MemStorage();
