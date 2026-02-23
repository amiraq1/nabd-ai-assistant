# Nabd AI Assistant - Lessons Learned

## 2026-02-22

### 1) Route handlers become brittle when they own AI orchestration

- Keeping provider calls, context assembly, and tool logic inside one route increases change risk.
- Splitting into `provider`, `tools`, and `orchestrator` makes each layer easier to evolve independently.

### 2) Start with one deterministic tool before adding function-calling complexity

- A direct built-in tool for time/date gives immediate value with low risk.
- This creates a safe path to add richer tools (search, weather, calendar) with schema contracts later.

### 3) Documentation must evolve with architecture

- A missing `README.md` and task tracking slows onboarding and planning.
- Adding a roadmap and task files aligned implementation work with product goals.

### 4) Planner-first orchestration simplifies multi-tool execution

- Parsing the request into explicit steps before execution reduced branching complexity in route handlers.
- A final synthesis step kept responses coherent when multiple tools were used in one user request.

### 5) RAG does not require heavy infrastructure to start

- A lightweight in-memory vector store was enough to establish retrieval flow and prompt augmentation.
- This allows shipping retrieval benefits now, then swapping storage to pgvector/managed services later.

### 6) Debug traces are essential once planner + tools + RAG are combined

- Returning only final assistant text hides where errors happen (planning vs tool vs retrieval).
- Capturing per-turn trace (plan, tool latency/errors, retrieved context) made debugging deterministic.

### 7) Debug endpoints must be treated as privileged surfaces

- Debug APIs can expose internal planning, tool inputs, and retrieved context.
- Enforcing token-based auth and explicit production enablement prevents accidental exposure.

## 2026-02-23

### 1) Skills-as-folders simplify extension velocity

- Moving capabilities to `skills/*/skill.json` removed hardcoded coupling between planner and tool registry.
- Teams can add/modify a capability by adding one folder + handler mapping without touching orchestration flow.

### 2) Function-calling needs graceful degradation

- Tool-call payloads are provider-dependent and sometimes rejected.
- A compatibility fallback (retry without `tools`) keeps response generation reliable while preserving enhanced behavior where supported.

### 3) Context compression improves stability in long chats

- Summarizing older turns and keeping only recent messages reduced prompt bloat.
- This keeps planning/tool context visible while lowering token pressure and latency variance.

### 4) Agent Skills interoperability should coexist with local execution schemas

- Supporting both `skill.json` (executable) and standard `SKILL.md` (instructional) avoids lock-in.
- This enables importing third-party skills directly while preserving deterministic tool execution in local runtime.

### 5) Prompt profile IDs are safer than raw prompt payloads from clients

- Passing `systemPromptId` from UI prevents accidental prompt drift and limits client-side prompt injection surface.
- Keeping full prompt text on the server makes governance and updates consistent across all clients.
