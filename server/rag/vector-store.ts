export interface VectorStoreDocument {
  id: string;
  title: string;
  source: string;
  content: string;
}

export interface VectorSearchResult extends VectorStoreDocument {
  score: number;
}

const VECTOR_SIZE = 256;

interface StoredDocument extends VectorStoreDocument {
  vector: number[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\u0600-\u06FF\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash % VECTOR_SIZE;
}

function toNormalizedVector(text: string): number[] {
  const vector = new Array<number>(VECTOR_SIZE).fill(0);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    vector[hashToken(token)] += 1;
  }

  let magnitude = 0;
  for (const value of vector) {
    magnitude += value * value;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) {
    return vector;
  }

  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = vector[i] / magnitude;
  }

  return vector;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

export class InMemoryVectorStore {
  private readonly documents = new Map<string, StoredDocument>();

  replaceAll(docs: VectorStoreDocument[]): void {
    this.documents.clear();
    this.upsertMany(docs);
  }

  upsertMany(docs: VectorStoreDocument[]): void {
    for (const doc of docs) {
      const enriched: StoredDocument = {
        ...doc,
        vector: toNormalizedVector(`${doc.title}\n${doc.content}`),
      };
      this.documents.set(doc.id, enriched);
    }
  }

  search(query: string, topK = 3): VectorSearchResult[] {
    const queryVector = toNormalizedVector(query);
    const scored = Array.from(this.documents.values()).map((doc) => ({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      content: doc.content,
      score: cosineSimilarity(queryVector, doc.vector),
    }));

    return scored
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, topK));
  }

  listDocuments(): VectorStoreDocument[] {
    return Array.from(this.documents.values()).map((doc) => ({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      content: doc.content,
    }));
  }

  size(): number {
    return this.documents.size;
  }
}
