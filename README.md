# Nabd AI Assistant

`Nabd AI Assistant` is an Arabic-first chat assistant built with React + Express and PostgreSQL.  
It currently supports conversational memory and model responses through NVIDIA-hosted LLMs.

## Tech Stack

- Frontend: React, Vite, Tailwind, Radix UI
- Backend: Node.js, Express
- Database: PostgreSQL + Drizzle ORM
- LLM Provider: NVIDIA API (`meta/llama-3.1-70b-instruct` by default)

## Current Architecture

- `server/routes.ts`: HTTP API routes for conversations and messages.
- `server/storage.ts`: DB access layer.
- `server/ai/provider.ts`: model provider integration.
- `server/ai/orchestrator.ts`: assistant orchestration layer.
- `server/ai/tools.ts`: tool registry (schema + execution).
- `server/ai/planner.ts`: simple planner for multi-step requests.
- `server/rag/*`: local vector-store retrieval pipeline.

## Implemented Agent Foundation (Phase 1)

The project now includes a practical agent architecture baseline:

- Unified Tool Schema and execution registry.
- Tools:
  - `date_time`: current date/time.
  - `weather`: live weather via Open-Meteo.
  - `web_search`: live web lookup (Wikipedia search API).
- `Planner Agent` (heuristic): splits multi-intent requests into executable tool steps + synthesis.
- `RAG` retrieval stage: in-memory vector store retrieves relevant internal knowledge before generation.
- `Orchestration Layer`: composes plan + tools + RAG context and sends structured context to the model.
- Debug/observability endpoints for tracing plans, tool runs, and RAG context in development.

## Environment Variables

Set the following variables before running:

- `DATABASE_URL`: PostgreSQL connection string.
- `NVIDIA_API_KEY`: API key for NVIDIA model inference.
- `AI_ENDPOINT` (optional): override model endpoint.
- `AI_MODEL` (optional): override default model.
- `DEBUG_API_TOKEN` (required if debug endpoints are enabled): token for debug endpoint auth.
- `ENABLE_AI_DEBUG_ENDPOINTS` (optional): set `true` to enable debug endpoints in production.

## Development

```bash
npm install
npm run check
npm run dev
```

## Vercel Deployment (Frontend + API)

This repository builds two outputs:

- `dist/public`: Vite frontend files (what Vercel should serve).
- `dist/index.cjs`: Node server bundle for non-Vercel Node hosting.

To avoid serving the Node bundle as the website root, Vercel is configured via `vercel.json` to:

- run `npm run build`
- publish `dist/public`
- route `/api/*` to a Vercel Node function (`api/index.ts`) that reuses the Express routes.
- fallback non-file frontend paths to `index.html` for SPA routing.

After pulling these changes, redeploy the project in Vercel.  
If you have Build & Output overrides set in the Vercel dashboard, disable them so `vercel.json` is respected.

### Debug Endpoints (development only)

- `POST /api/ai/debug/plan` with `{ "content": "..." }`
- `GET /api/ai/debug/trace/latest?conversationId=<id>`
- `GET /api/ai/debug/trace/history?conversationId=<id>&limit=10`
- `GET /api/ai/debug/rag/documents`
- `POST /api/ai/debug/rag/documents` with `{ "documents": [...] }`

Auth for debug endpoints:

- Use `Authorization: Bearer <DEBUG_API_TOKEN>` or header `x-debug-token: <DEBUG_API_TOKEN>`.
- Debug endpoints are disabled unless `DEBUG_API_TOKEN` is configured.
- In production, debug endpoints also require `ENABLE_AI_DEBUG_ENDPOINTS=true`.

## Roadmap (Short Version)

- Phase 1: Tool use + orchestration foundation (done).
- Phase 2: RAG with external/vector DB persistence (next).
- Phase 3: advanced multi-agent workflows (next).

Detailed implementation tasks are tracked in:

- `tasks/todo.md`
- `tasks/lessons.md`
