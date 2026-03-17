import fs from "fs";
import path from "path";
import { KNOWLEDGE_DOCUMENTS } from "./knowledge.js";
import {
  InMemoryVectorStore,
  type VectorSearchResult,
  type VectorStoreDocument,
  type VectorStoreDocumentMetadata,
  tokenizeSearchText,
  normalizeSearchText,
} from "./vector-store.js";

export interface RetrievedContext {
  title: string;
  source: string;
  content: string;
  score: number;
  documentId: string;
  chunkStart: number;
  chunkEnd: number;
  matchedTerms: string[];
  retrievalQueries: string[];
}

interface RetrievalCandidate extends VectorSearchResult {
  retrievalQueries: Set<string>;
}

interface RetrievedContextRange {
  start: number;
  end: number;
}

const MIN_SCORE = 0.2;
const MAX_SEARCH_VARIANTS = 4;
const MAX_CANDIDATES_PER_QUERY = 10;
const MAX_CONTEXT_CHARS = 1_400;
const PERSISTED_STORE_PATH = process.env.RAG_STORE_PATH?.trim()
  ? path.resolve(process.cwd(), process.env.RAG_STORE_PATH.trim())
  : path.resolve(process.cwd(), "data", "rag-documents.json");

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
  "what",
  "when",
  "where",
  "why",
  "هل",
  "في",
  "من",
  "على",
  "الى",
  "إلى",
  "عن",
  "ما",
  "ماذا",
  "كيف",
  "متى",
  "اين",
  "أين",
  "ثم",
  "او",
  "أو",
  "مع",
  "كل",
  "تم",
  "بعد",
  "قبل",
  "بين",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
]);

const store = new InMemoryVectorStore();

function isInternalDocument(document: Pick<VectorStoreDocument, "source">): boolean {
  return document.source.startsWith("internal://");
}

function isMetadataValue(value: unknown): value is VectorStoreDocumentMetadata[keyof VectorStoreDocumentMetadata] {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function normalizeMetadata(value: unknown): VectorStoreDocumentMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const metadata = Object.entries(value).reduce<VectorStoreDocumentMetadata>((accumulator, entry) => {
    const [key, item] = entry;
    if (isMetadataValue(item)) {
      accumulator[key] = item;
    }
    return accumulator;
  }, {});

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function loadPersistedDocuments(): VectorStoreDocument[] {
  try {
    if (!fs.existsSync(PERSISTED_STORE_PATH)) {
      return [];
    }

    const raw = fs.readFileSync(PERSISTED_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): VectorStoreDocument | null => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const value = item as Record<string, unknown>;
        const id = typeof value.id === "string" ? value.id.trim() : "";
        const title = typeof value.title === "string" ? value.title.trim() : "";
        const source = typeof value.source === "string" ? value.source.trim() : "";
        const content = typeof value.content === "string" ? value.content.trim() : "";

        if (!id || !title || !source || !content) {
          return null;
        }

        const metadata = normalizeMetadata(value.metadata);
        return {
          id,
          title,
          source,
          content,
          ...(metadata ? { metadata } : {}),
        };
      })
      .filter((document): document is VectorStoreDocument => document !== null);
  } catch (error) {
    console.warn("[rag] failed to load persisted store:", error);
    return [];
  }
}

function savePersistedDocuments(documents: VectorStoreDocument[]): void {
  try {
    const directory = path.dirname(PERSISTED_STORE_PATH);
    fs.mkdirSync(directory, { recursive: true });
    const persistedDocuments = documents.filter((document) => !isInternalDocument(document));
    fs.writeFileSync(PERSISTED_STORE_PATH, JSON.stringify(persistedDocuments, null, 2), "utf8");
  } catch (error) {
    console.warn("[rag] failed to persist store:", error);
  }
}

function bootstrapStore(): void {
  const persisted = loadPersistedDocuments();
  if (persisted.length === 0) {
    store.replaceAll(KNOWLEDGE_DOCUMENTS);
    return;
  }

  const merged = new Map<string, VectorStoreDocument>();
  for (const document of persisted) {
    merged.set(document.id, document);
  }
  for (const document of KNOWLEDGE_DOCUMENTS) {
    merged.set(document.id, document);
  }

  const mergedDocuments = Array.from(merged.values());
  store.replaceAll(mergedDocuments);
  savePersistedDocuments(mergedDocuments);
}

function dedupeStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean)));
}

function buildQueryVariants(query: string): string[] {
  const normalized = normalizeSearchText(query);
  const tokens = tokenizeSearchText(query);
  const significantTokens = tokens.filter(
    (token) => token.length > 2 && !STOP_WORDS.has(token),
  );
  const variants = new Set<string>();

  if (normalized) {
    variants.add(normalized);
  }

  if (significantTokens.length > 0) {
    variants.add(significantTokens.join(" "));
  }

  if (significantTokens.length >= 3) {
    variants.add(significantTokens.slice(0, 3).join(" "));
  }

  if (significantTokens.length >= 4) {
    variants.add(significantTokens.slice(-3).join(" "));
  }

  return Array.from(variants)
    .map((variant) => variant.trim())
    .filter(Boolean)
    .slice(0, MAX_SEARCH_VARIANTS);
}

function mergeCandidate(target: RetrievalCandidate | undefined, next: VectorSearchResult, query: string): RetrievalCandidate {
  if (!target) {
    return {
      ...next,
      retrievalQueries: new Set([query]),
      matchedTerms: [...next.matchedTerms],
    };
  }

  target.score = Math.max(target.score, next.score);
  target.semanticScore = Math.max(target.semanticScore, next.semanticScore);
  target.lexicalScore = Math.max(target.lexicalScore, next.lexicalScore);
  target.titleScore = Math.max(target.titleScore, next.titleScore);
  target.matchedTerms = dedupeStrings([...target.matchedTerms, ...next.matchedTerms]);
  target.retrievalQueries.add(query);

  return target;
}

function rerankCandidate(candidate: RetrievalCandidate, userQuery: string): number {
  const queryTokens = tokenizeSearchText(userQuery);
  const significantTokens = queryTokens.filter(
    (token) => token.length > 2 && !STOP_WORDS.has(token),
  );
  const matchedTerms = dedupeStrings(candidate.matchedTerms);
  const queryCoverage =
    significantTokens.length > 0 ? matchedTerms.length / significantTokens.length : 0;
  const multiQueryBoost = Math.min(0.15, (candidate.retrievalQueries.size - 1) * 0.06);
  const exactPhraseBonus =
    normalizeSearchText(candidate.content).includes(normalizeSearchText(userQuery)) &&
    normalizeSearchText(userQuery).length > 4
      ? 0.08
      : 0;

  return Math.min(1.35, candidate.score + queryCoverage * 0.18 + multiQueryBoost + exactPhraseBonus);
}

function compressContent(parts: string[]): string {
  const uniqueParts = parts.reduce<string[]>((accumulator, part) => {
    const normalized = part.replace(/\s+/g, " ").trim();
    if (normalized && !accumulator.includes(normalized)) {
      accumulator.push(normalized);
    }
    return accumulator;
  }, []);

  const combined = uniqueParts.join("\n\n").trim();
  if (combined.length <= MAX_CONTEXT_CHARS) {
    return combined;
  }

  return `${combined.slice(0, MAX_CONTEXT_CHARS - 1).trimEnd()}…`;
}

function chooseBestRange(candidates: RetrievalCandidate[]): {
  range: RetrievedContextRange;
  score: number;
  parts: string[];
  matchedTerms: string[];
  retrievalQueries: string[];
} {
  const ordered = [...candidates].sort((left, right) => left.chunkIndex - right.chunkIndex);
  let bestRange: RetrievedContextRange = {
    start: ordered[0]?.chunkIndex ?? 0,
    end: ordered[0]?.chunkIndex ?? 0,
  };
  let bestScore = ordered[0]?.score ?? 0;
  let bestParts = ordered[0] ? [ordered[0].content] : [];
  let bestMatchedTerms = ordered[0] ? [...ordered[0].matchedTerms] : [];
  let bestQueries = ordered[0] ? Array.from(ordered[0].retrievalQueries) : [];

  let currentRange: RetrievedContextRange | null = null;
  let currentScore = 0;
  let currentParts: string[] = [];
  let currentMatchedTerms = new Set<string>();
  let currentQueries = new Set<string>();

  for (const candidate of ordered) {
    if (!currentRange) {
      currentRange = { start: candidate.chunkIndex, end: candidate.chunkIndex };
      currentScore = candidate.score;
      currentParts = [candidate.content];
      currentMatchedTerms = new Set(candidate.matchedTerms);
      currentQueries = new Set(candidate.retrievalQueries);
      continue;
    }

    if (candidate.chunkIndex <= currentRange.end + 1) {
      currentRange.end = candidate.chunkIndex;
      currentScore += candidate.score * 0.82;
      currentParts.push(candidate.content);
      for (const term of candidate.matchedTerms) {
        currentMatchedTerms.add(term);
      }
      for (const retrievalQuery of Array.from(candidate.retrievalQueries)) {
        currentQueries.add(retrievalQuery);
      }
      continue;
    }

    if (currentScore > bestScore) {
      bestRange = currentRange;
      bestScore = currentScore;
      bestParts = [...currentParts];
      bestMatchedTerms = Array.from(currentMatchedTerms);
      bestQueries = Array.from(currentQueries);
    }

    currentRange = { start: candidate.chunkIndex, end: candidate.chunkIndex };
    currentScore = candidate.score;
    currentParts = [candidate.content];
    currentMatchedTerms = new Set(candidate.matchedTerms);
    currentQueries = new Set(candidate.retrievalQueries);
  }

  if (currentRange && currentScore > bestScore) {
    bestRange = currentRange;
    bestScore = currentScore;
    bestParts = currentParts;
    bestMatchedTerms = Array.from(currentMatchedTerms);
    bestQueries = Array.from(currentQueries);
  }

  return {
    range: bestRange,
    score: bestScore,
    parts: bestParts,
    matchedTerms: dedupeStrings(bestMatchedTerms),
    retrievalQueries: dedupeStrings(bestQueries),
  };
}

bootstrapStore();

export function retrieveKnowledgeContext(query: string, topK = 3): RetrievedContext[] {
  const variants = buildQueryVariants(query);
  if (variants.length === 0) {
    return [];
  }

  const mergedCandidates = new Map<string, RetrievalCandidate>();

  for (const variant of variants) {
    const results = store.search(variant, Math.max(MAX_CANDIDATES_PER_QUERY, topK * 4));
    for (const result of results) {
      mergedCandidates.set(
        result.chunkId,
        mergeCandidate(mergedCandidates.get(result.chunkId), result, variant),
      );
    }
  }

  const reranked = Array.from(mergedCandidates.values())
    .map((candidate) => ({
      ...candidate,
      score: rerankCandidate(candidate, query),
      matchedTerms: dedupeStrings(candidate.matchedTerms),
    }))
    .filter((candidate) => candidate.score >= MIN_SCORE)
    .sort((left, right) => right.score - left.score);

  const byDocument = reranked.reduce<Map<string, RetrievalCandidate[]>>((accumulator, candidate) => {
    const existing = accumulator.get(candidate.documentId) ?? [];
    existing.push(candidate);
    accumulator.set(candidate.documentId, existing);
    return accumulator;
  }, new Map());

  const contexts: RetrievedContext[] = [];

  for (const [documentId, candidates] of Array.from(byDocument.entries())) {
    const best = chooseBestRange(candidates);
    const anchor = candidates[0];
    if (!anchor) {
      continue;
    }

    contexts.push({
      title: anchor.title,
      source: anchor.source,
      content: compressContent(best.parts),
      score: Math.min(1.4, best.score),
      documentId,
      chunkStart: best.range.start,
      chunkEnd: best.range.end,
      matchedTerms: best.matchedTerms,
      retrievalQueries: best.retrievalQueries,
    });
  }

  return contexts
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

export function upsertKnowledgeDocuments(documents: VectorStoreDocument[]): void {
  store.upsertMany(documents);
  savePersistedDocuments(store.listDocuments());
}

export function listKnowledgeDocuments(): VectorStoreDocument[] {
  return store.listDocuments();
}
