export interface KnowledgeDocument {
  id: string;
  title: string;
  source: string;
  content: string;
}

export const KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: "nabd-capabilities",
    title: "Nabd core capabilities",
    source: "internal://nabd/capabilities",
    content:
      "Nabd AI Assistant provides Arabic-first conversations, prompt orchestration, tool execution, and conversation-aware responses. " +
      "It can combine direct model output with tool results, planning steps, and retrieved knowledge context. " +
      "Keywords: assistant, chat, tools, orchestration, conversation history, مساعد, محادثة, أدوات, سياق.",
  },
  {
    id: "nabd-tools",
    title: "Nabd tool execution",
    source: "internal://nabd/tools",
    content:
      "The assistant can call internal tools such as weather, web search, time, and project-aware utilities when they add real value. " +
      "Multi-step requests are planned first, then executed, and the outputs are merged into one final answer. " +
      "Keywords: tools, planner, execution, weather, web search, time, تخطيط, تنفيذ, أدوات.",
  },
  {
    id: "nabd-answer-quality",
    title: "Answer quality guidelines",
    source: "internal://nabd/guidelines",
    content:
      "High-quality answers should be clear, direct, and explicit about uncertainty. " +
      "When source data is incomplete, the assistant should say what is missing instead of guessing. " +
      "When tool or retrieval context exists, it should be summarized faithfully before adding conclusions. " +
      "Keywords: quality, uncertainty, citations, faithfulness, عدم اليقين, دقة, مراجع.",
  },
  {
    id: "nabd-rag-architecture",
    title: "RAG architecture",
    source: "internal://nabd/rag-architecture",
    content:
      "The RAG system chunks long documents into smaller sections with light overlap, then runs hybrid retrieval using semantic similarity plus keyword overlap. " +
      "Results from multiple query variants are reranked, grouped by document, and compressed before they are injected into the model context window. " +
      "If the retrieved context is weak or missing, the assistant must state that clearly instead of inventing facts. " +
      "Keywords: RAG, retrieval, context, chunking, reranking, hybrid search, hallucination guardrails, استرجاع, سياق, تقطيع, إعادة ترتيب.",
  },
  {
    id: "nabd-workspace-projects",
    title: "Workspace and projects",
    source: "internal://nabd/workspace-projects",
    content:
      "The app builder uses /workspace to create a new app and /workspace/:id to reopen an existing project for editing. " +
      "The dashboard on /dashboard lists saved projects, while GET, POST, PUT, and DELETE project endpoints handle loading, saving, updating, and deleting records. " +
      "A saved UI schema can be loaded into the live preview canvas, modified iteratively, and persisted back to the same project. " +
      "Keywords: workspace, projects, dashboard, ui schema, live preview, save, update, delete, مساحة العمل, المشاريع, لوحة التحكم, حفظ, تعديل.",
  },
  {
    id: "nabd-ide-files",
    title: "IDE and file explorer",
    source: "internal://nabd/ide-files",
    content:
      "The web IDE combines a file explorer, Monaco editor, autosave, preview iframe, and a console panel inside one layout. " +
      "The file explorer supports tree navigation, inline rename, create, delete, and file content editing through API routes. " +
      "The IDE preview is optimized for browser-ready HTML, CSS, and JavaScript files and exposes runtime logs in a dedicated console view. " +
      "Keywords: IDE, Monaco, file explorer, autosave, preview, console, ملفات, محرر, معاينة.",
  },
];
