import type { Express, RequestHandler } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import {
  generateAssistantReply,
  previewOrchestration,
} from "./ai/orchestrator";
import {
  getLatestTrace,
  getTraceHistory,
  recordTrace,
} from "./ai/trace-store";
import {
  listKnowledgeDocuments,
  upsertKnowledgeDocuments,
} from "./rag/retriever";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";
  const debugMode = !isProduction;
  const debugEndpointsEnabled =
    debugMode || process.env.ENABLE_AI_DEBUG_ENDPOINTS === "true";
  const debugToken = process.env.DEBUG_API_TOKEN?.trim();

  const requireDebugAuth: RequestHandler = (req, res, next) => {
    if (!debugToken) {
      return res.status(503).json({
        message:
          "واجهات التشخيص معطلة لأن DEBUG_API_TOKEN غير مضبوط",
      });
    }

    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : undefined;
    const customToken =
      typeof req.headers["x-debug-token"] === "string"
        ? req.headers["x-debug-token"].trim()
        : undefined;
    const suppliedToken = bearerToken || customToken;

    if (!suppliedToken || suppliedToken !== debugToken) {
      return res.status(401).json({ message: "Unauthorized debug access" });
    }

    return next();
  };

  if (debugEndpointsEnabled) {
    app.post("/api/ai/debug/plan", requireDebugAuth, (req, res) => {
      const content = req.body?.content;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "الحقل content مطلوب" });
      }

      const preview = previewOrchestration(content);
      return res.json(preview);
    });

    app.get("/api/ai/debug/trace/latest", requireDebugAuth, (req, res) => {
      const conversationId =
        typeof req.query.conversationId === "string"
          ? req.query.conversationId
          : undefined;
      const trace = getLatestTrace(conversationId);

      if (!trace) {
        return res.status(404).json({ message: "لا يوجد trace متاح حالياً" });
      }

      return res.json(trace);
    });

    app.get("/api/ai/debug/trace/history", requireDebugAuth, (req, res) => {
      const conversationId =
        typeof req.query.conversationId === "string"
          ? req.query.conversationId
          : undefined;
      const limitValue =
        typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 10;
      const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 50) : 10;

      return res.json({
        count: limit,
        items: getTraceHistory(conversationId, limit),
      });
    });

    app.get("/api/ai/debug/rag/documents", requireDebugAuth, (_req, res) => {
      return res.json({
        items: listKnowledgeDocuments(),
      });
    });

    app.post("/api/ai/debug/rag/documents", requireDebugAuth, (req, res) => {
      const docs = req.body?.documents;
      if (!Array.isArray(docs) || docs.length === 0) {
        return res.status(400).json({
          message: "الحقل documents مطلوب ويجب أن يكون مصفوفة غير فارغة",
        });
      }

      type IngestDocument = {
        id: string;
        title: string;
        source: string;
        content: string;
      };

      const isIngestDocument = (value: IngestDocument | null): value is IngestDocument =>
        value !== null;

      const prepared = docs
        .map((doc: unknown, index: number) => {
          if (!doc || typeof doc !== "object") return null;
          const value = doc as Record<string, unknown>;
          const title = typeof value.title === "string" ? value.title.trim() : "";
          const source = typeof value.source === "string" ? value.source.trim() : "";
          const content = typeof value.content === "string" ? value.content.trim() : "";

          if (!title || !source || !content) return null;
          return {
            id:
              typeof value.id === "string" && value.id.trim()
                ? value.id.trim()
                : `debug-doc-${Date.now()}-${index}`,
            title,
            source,
            content,
          };
        })
        .filter(isIngestDocument);

      if (prepared.length === 0) {
        return res.status(400).json({
          message: "لا يوجد مستندات صالحة للإدخال",
        });
      }

      upsertKnowledgeDocuments(prepared);
      return res.json({
        inserted: prepared.length,
        total: listKnowledgeDocuments().length,
      });
    });
  }

  app.get("/api/conversations", async (_req, res) => {
    const convs = await storage.getConversations();
    res.json(convs);
  });

  app.post("/api/conversations", async (req, res) => {
    const { title } = req.body;
    if (!title || typeof title !== "string") {
      return res.status(400).json({ message: "العنوان مطلوب" });
    }
    const conv = await storage.createConversation({ title });
    res.json(conv);
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    await storage.deleteConversation(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    const msgs = await storage.getMessages(req.params.id);
    res.json(msgs);
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    const { content, role, systemPrompt } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ message: "المحتوى مطلوب" });
    }

    const userMsg = await storage.createMessage({
      conversationId: req.params.id,
      content,
      role: role || "user",
    });

    try {
      const previousMessages = await storage.getMessages(req.params.id);
      const history = previousMessages
        .filter((msg) => msg.id !== userMsg.id)
        .map((msg) => ({ role: msg.role, content: msg.content }));

      const result = await generateAssistantReply({
        content,
        systemPrompt,
        history,
      });
      recordTrace(req.params.id, result.trace);

      const aiMsg = await storage.createMessage({
        conversationId: req.params.id,
        content: result.content,
        role: "assistant",
      });

      res.json([userMsg, aiMsg]);
    } catch (error) {
      console.error("AI API error:", error);

      const errorMsg = await storage.createMessage({
        conversationId: req.params.id,
        content: "عذراً، فشل الاتصال بالخادم المحلي. يرجى المحاولة مرة أخرى.",
        role: "assistant",
      });

      res.json([userMsg, errorMsg]);
    }
  });

  return httpServer;
}
