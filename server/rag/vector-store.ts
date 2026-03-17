export type VectorStoreDocumentMetadataValue = string | number | boolean | string[];

export type VectorStoreDocumentMetadata = Record<string, VectorStoreDocumentMetadataValue>;

export interface VectorStoreDocument {
  id: string;
  title: string;
  source: string;
  content: string;
  metadata?: VectorStoreDocumentMetadata;
}

export interface VectorSearchResult extends VectorStoreDocument {
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  score: number;
  semanticScore: number;
  lexicalScore: number;
  titleScore: number;
  matchedTerms: string[];
}

const VECTOR_SIZE = 384;
const TARGET_CHUNK_CHARS = 680;
const MAX_CHUNK_CHARS = 900;
const MIN_CHUNK_CHARS = 220;
const OVERLAP_UNITS = 1;

interface StoredChunk {
  id: string;
  documentId: string;
  title: string;
  source: string;
  content: string;
  metadata?: VectorStoreDocumentMetadata;
  chunkIndex: number;
  totalChunks: number;
  vector: number[];
  tokenCounts: Map<string, number>;
  tokenTotal: number;
  titleTerms: Set<string>;
  normalizedTitle: string;
  normalizedContent: string;
}

function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "");
}

export function normalizeSearchText(text: string): string {
  return normalizeArabic(text)
    .toLowerCase()
    .replace(/[^a-z0-9_\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchText(text: string): string[] {
  return normalizeSearchText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function hashToken(token: string): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash % VECTOR_SIZE;
}

function toNormalizedVector(text: string): number[] {
  const vector = new Array<number>(VECTOR_SIZE).fill(0);
  const tokens = tokenizeSearchText(text);

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

  for (let index = 0; index < vector.length; index += 1) {
    vector[index] = vector[index] / magnitude;
  }

  return vector;
}

function cosineSimilarity(left: number[], right: number[]): number {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * right[index];
  }
  return sum;
}

function splitOversizedUnit(unit: string): string[] {
  if (unit.length <= MAX_CHUNK_CHARS) {
    return [unit];
  }

  const sentences = unit
    .split(/(?<=[.!?؟؛])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length > 1) {
    return sentences.flatMap((sentence) => splitOversizedUnit(sentence));
  }

  const words = unit.split(/\s+/).filter(Boolean);
  const segments: string[] = [];
  let cursor = 0;

  while (cursor < words.length) {
    const slice = words.slice(cursor, cursor + 120).join(" ").trim();
    if (slice) {
      segments.push(slice);
    }
    cursor += 100;
  }

  return segments.length > 0 ? segments : [unit];
}

function splitIntoUnits(content: string): string[] {
  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return content.trim() ? [content.trim()] : [];
  }

  return paragraphs.flatMap((paragraph) => splitOversizedUnit(paragraph));
}

function buildChunks(document: VectorStoreDocument): string[] {
  const units = splitIntoUnits(document.content);
  if (units.length === 0) {
    return document.content.trim() ? [document.content.trim()] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < units.length) {
    let end = start;
    let size = 0;
    const chunkUnits: string[] = [];

    while (end < units.length) {
      const nextUnit = units[end];
      const nextSize = size === 0 ? nextUnit.length : size + 2 + nextUnit.length;
      const shouldTake =
        chunkUnits.length === 0 || nextSize <= TARGET_CHUNK_CHARS || size < MIN_CHUNK_CHARS;

      if (!shouldTake) {
        break;
      }

      chunkUnits.push(nextUnit);
      size = nextSize;
      end += 1;

      if (size >= MAX_CHUNK_CHARS) {
        break;
      }
    }

    const chunk = chunkUnits.join("\n\n").trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= units.length) {
      break;
    }

    start = Math.max(start + 1, end - OVERLAP_UNITS);
  }

  return chunks.length > 0 ? chunks : [document.content.trim()];
}

function buildTokenCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function buildStoredChunks(document: VectorStoreDocument): StoredChunk[] {
  const chunks = buildChunks(document);

  return chunks.map((content, chunkIndex) => {
    const titleTerms = new Set(tokenizeSearchText(document.title));
    const chunkTokens = tokenizeSearchText(content);
    return {
      id: `${document.id}::${chunkIndex}`,
      documentId: document.id,
      title: document.title,
      source: document.source,
      content,
      metadata: document.metadata,
      chunkIndex,
      totalChunks: chunks.length,
      vector: toNormalizedVector(`${document.title}\n${content}`),
      tokenCounts: buildTokenCounts(chunkTokens),
      tokenTotal: chunkTokens.length,
      titleTerms,
      normalizedTitle: normalizeSearchText(document.title),
      normalizedContent: normalizeSearchText(content),
    };
  });
}

function computeLexicalScore(queryTerms: string[], chunk: StoredChunk): {
  score: number;
  matchedTerms: string[];
} {
  if (queryTerms.length === 0) {
    return { score: 0, matchedTerms: [] };
  }

  const matchedTerms = queryTerms.filter(
    (term) => chunk.tokenCounts.has(term) || chunk.titleTerms.has(term),
  );

  if (matchedTerms.length === 0) {
    return { score: 0, matchedTerms };
  }

  const totalMatches = matchedTerms.reduce(
    (sum, term) => sum + (chunk.tokenCounts.get(term) ?? 0),
    0,
  );
  const coverage = matchedTerms.length / queryTerms.length;
  const density = totalMatches / Math.max(chunk.tokenTotal, 12);
  const score = Math.min(1, coverage * 0.72 + density * 2.2);

  return { score, matchedTerms };
}

function computeTitleScore(queryTerms: string[], normalizedQuery: string, chunk: StoredChunk): number {
  if (queryTerms.length === 0) {
    return 0;
  }

  const titleMatches = queryTerms.filter((term) => chunk.titleTerms.has(term)).length;
  const coverage = titleMatches / queryTerms.length;
  const exactTitleBonus =
    normalizedQuery.length > 0 && chunk.normalizedTitle.includes(normalizedQuery) ? 0.2 : 0;

  return Math.min(1, coverage + exactTitleBonus);
}

export class InMemoryVectorStore {
  private readonly documents = new Map<string, VectorStoreDocument>();
  private readonly chunks = new Map<string, StoredChunk>();

  replaceAll(documents: VectorStoreDocument[]): void {
    this.documents.clear();
    this.chunks.clear();
    this.upsertMany(documents);
  }

  upsertMany(documents: VectorStoreDocument[]): void {
    for (const document of documents) {
      this.documents.set(document.id, document);

      for (const [chunkId, chunk] of Array.from(this.chunks.entries())) {
        if (chunk.documentId === document.id) {
          this.chunks.delete(chunkId);
        }
      }

      const storedChunks = buildStoredChunks(document);
      for (const chunk of storedChunks) {
        this.chunks.set(chunk.id, chunk);
      }
    }
  }

  search(query: string, topK = 3): VectorSearchResult[] {
    const normalizedQuery = normalizeSearchText(query);
    const queryTerms = Array.from(new Set(tokenizeSearchText(query)));
    const queryVector = toNormalizedVector(query);

    if (normalizedQuery.length === 0) {
      return [];
    }

    const scored = Array.from(this.chunks.values()).map((chunk) => {
      const semanticScore = cosineSimilarity(queryVector, chunk.vector);
      const lexical = computeLexicalScore(queryTerms, chunk);
      const titleScore = computeTitleScore(queryTerms, normalizedQuery, chunk);
      const exactContentBonus =
        chunk.normalizedContent.includes(normalizedQuery) && normalizedQuery.length > 3 ? 0.12 : 0;
      const score =
        semanticScore * 0.52 + lexical.score * 0.33 + titleScore * 0.15 + exactContentBonus;

      return {
        id: chunk.id,
        documentId: chunk.documentId,
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        title: chunk.title,
        source: chunk.source,
        content: chunk.content,
        metadata: chunk.metadata,
        semanticScore,
        lexicalScore: lexical.score,
        titleScore,
        matchedTerms: lexical.matchedTerms,
        score: Math.min(1.2, score),
      };
    });

    return scored
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, topK));
  }

  listDocuments(): VectorStoreDocument[] {
    return Array.from(this.documents.values());
  }

  size(): number {
    return this.documents.size;
  }
}
