import type { OrchestrationTrace } from "./orchestrator";

const MAX_HISTORY_PER_CONVERSATION = 30;
const MAX_GLOBAL_HISTORY = 80;

const conversationHistory = new Map<string, OrchestrationTrace[]>();
const globalHistory: OrchestrationTrace[] = [];

function trimHistory<T>(items: T[], maxSize: number): T[] {
  if (items.length <= maxSize) return items;
  return items.slice(items.length - maxSize);
}

export function recordTrace(conversationId: string, trace: OrchestrationTrace): void {
  const currentConversationHistory = conversationHistory.get(conversationId) ?? [];
  currentConversationHistory.push(trace);
  conversationHistory.set(
    conversationId,
    trimHistory(currentConversationHistory, MAX_HISTORY_PER_CONVERSATION)
  );

  globalHistory.push(trace);
  const trimmedGlobal = trimHistory(globalHistory, MAX_GLOBAL_HISTORY);
  globalHistory.length = 0;
  globalHistory.push(...trimmedGlobal);
}

export function getLatestTrace(conversationId?: string): OrchestrationTrace | null {
  if (conversationId) {
    const items = conversationHistory.get(conversationId) ?? [];
    return items.length > 0 ? items[items.length - 1] : null;
  }

  return globalHistory.length > 0 ? globalHistory[globalHistory.length - 1] : null;
}

export function getTraceHistory(
  conversationId?: string,
  limit = 10
): OrchestrationTrace[] {
  const source = conversationId
    ? conversationHistory.get(conversationId) ?? []
    : globalHistory;
  return source.slice(Math.max(0, source.length - limit));
}
