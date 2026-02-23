---
name: arabic-writing
description: Improve Arabic writing quality (clarity, tone, structure, and readability). Use when users ask for rewriting, polishing, or professional Arabic phrasing.
compatibility: Works as an instruction skill for Nabd agent orchestration.
metadata:
  category: writing
  version: "1.0.0"
---

# Arabic Writing Skill

## When to use
- User asks to rewrite or improve Arabic text.
- User wants concise but professional Arabic output.
- User needs better structure, readability, and tone.

## Workflow
1. Detect target tone: رسمي، مهني، تسويقي، أو تعليمي.
2. Extract core meaning and preserve intent.
3. Rewrite with shorter sentences and strong transitions.
4. Remove redundancy and ambiguous wording.
5. Output as clean Markdown with clear hierarchy.

## Output quality checks
- Keep meaning unchanged.
- Prefer precise Arabic over literal translation.
- Ensure readability on first pass.
- Avoid over-ornamented language unless requested.

## Edge cases
- If user input is too short, ask for minimal context.
- If user requests legal/medical wording, add caveat and stay factual.
