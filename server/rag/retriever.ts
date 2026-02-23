import fs from "fs";
import path from "path";
import { KNOWLEDGE_DOCUMENTS } from "./knowledge.js";
import {
  InMemoryVectorStore,
  type VectorSearchResult,
  type VectorStoreDocument,
} from "./vector-store.js";

export interface RetrievedContext {
  title: string;
  source: string;
  content: string;
  score: number;
}

const MIN_SCORE = 0.08;
const PERSISTED_STORE_PATH = process.env.RAG_STORE_PATH?.trim()
  ? path.resolve(process.cwd(), process.env.RAG_STORE_PATH.trim())
  : path.resolve(process.cwd(), "data", "rag-documents.json");

const store = new InMemoryVectorStore();

function loadPersistedDocuments(): VectorStoreDocument[] {
  try {
    if (!fs.existsSync(PERSISTED_STORE_PATH)) return [];
    const raw = fs.readFileSync(PERSISTED_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const value = item as Record<string, unknown>;
        const id = typeof value.id === "string" ? value.id.trim() : "";
        const title = typeof value.title === "string" ? value.title.trim() : "";
        const source = typeof value.source === "string" ? value.source.trim() : "";
        const content = typeof value.content === "string" ? value.content.trim() : "";
        if (!id || !title || !source || !content) return null;
        return { id, title, source, content };
      })
      .filter((doc): doc is VectorStoreDocument => doc !== null);
  } catch (error) {
    console.warn("[rag] failed to load persisted store:", error);
    return [];
  }
}

function savePersistedDocuments(docs: VectorStoreDocument[]): void {
  try {
    const dir = path.dirname(PERSISTED_STORE_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERSISTED_STORE_PATH, JSON.stringify(docs, null, 2), "utf8");
  } catch (error) {
    console.warn("[rag] failed to persist store:", error);
  }
}

function bootstrapStore(): void {
  const persisted = loadPersistedDocuments();
  if (persisted.length === 0) {
    store.upsertMany(KNOWLEDGE_DOCUMENTS);
    savePersistedDocuments(store.listDocuments());
    return;
  }

  const merged = new Map<string, VectorStoreDocument>();
  for (const doc of KNOWLEDGE_DOCUMENTS) {
    merged.set(doc.id, doc);
  }
  for (const doc of persisted) {
    merged.set(doc.id, doc);
  }

  store.replaceAll(Array.from(merged.values()));
}

bootstrapStore();

export function retrieveKnowledgeContext(query: string, topK = 3): RetrievedContext[] {
  const results: VectorSearchResult[] = store.search(query, topK + 2);

  return results
    .filter((result) => result.score >= MIN_SCORE)
    .slice(0, topK)
    .map((result) => ({
      title: result.title,
      source: result.source,
      content: result.content,
      score: result.score,
    }));
}

export function upsertKnowledgeDocuments(docs: VectorStoreDocument[]): void {
  store.upsertMany(docs);
  savePersistedDocuments(store.listDocuments());
}

export function listKnowledgeDocuments(): VectorStoreDocument[] {
  return store.listDocuments();
}
