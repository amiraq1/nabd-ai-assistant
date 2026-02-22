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

const store = new InMemoryVectorStore();
store.upsertMany(KNOWLEDGE_DOCUMENTS);

export function retrieveKnowledgeContext(
  query: string,
  topK = 3
): RetrievedContext[] {
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
}

export function listKnowledgeDocuments(): VectorStoreDocument[] {
  return store.listDocuments();
}
