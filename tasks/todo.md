# Nabd AI Assistant - TODO

## Phase 1: Tool Use Foundation

- [x] Extract AI provider logic from `server/routes.ts` into dedicated AI layer.
- [x] Add orchestration service (`server/ai/orchestrator.ts`).
- [x] Add first built-in tool (`date_time`) for user time/date requests.
- [x] Add structured tool catalog with schemas (name, input, output).
- [x] Add `weather` tool with live API integration.
- [x] Add `web_search` tool with live API integration.
- [x] Add server logs/telemetry-style trace for tool execution (tool name, latency, failures).

## Phase 2: RAG Integration

- [x] Choose initial vector store implementation (in-memory hashed vectors).
- [x] Build initial knowledge ingestion (internal knowledge docs).
- [x] Implement retrieval step before generation.
- [ ] Upgrade to persistent vector DB (pgvector/managed) for production.
- [ ] Add source citation format in assistant responses.

## Phase 3: Planning + Multi-Agent

- [x] Introduce simple planner agent for multi-step requests.
- [ ] Define specialist agents (research, writing, budgeting, etc.).
- [ ] Add workflow state tracking for long-running tasks.
- [ ] Add guardrails for retries, timeouts, and partial failures.

## Quality and Safety

- [ ] Add unit tests for tools and orchestration.
- [ ] Add integration tests for conversation lifecycle.
- [ ] Add fallback strategy when model provider is unavailable.
- [ ] Add explicit validation/sanitization for user instructions passed to tools.
- [x] Restrict debug endpoints behind explicit auth in non-local environments.
