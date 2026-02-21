import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const AI_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const AI_MODEL = "meta/llama-3.1-70b-instruct";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
      const messages: { role: string; content: string }[] = [];

      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }

      const previousMessages = await storage.getMessages(req.params.id);
      for (const msg of previousMessages) {
        if (msg.id !== userMsg.id) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      messages.push({ role: "user", content });

      const aiRes = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages,
          stream: false,
        }),
      });

      if (!aiRes.ok) {
        throw new Error(`AI API responded with status ${aiRes.status}`);
      }

      const data = await aiRes.json();
      const aiContent = data.choices?.[0]?.message?.content || "عذراً، لم أتمكن من إنشاء رد.";

      const aiMsg = await storage.createMessage({
        conversationId: req.params.id,
        content: aiContent,
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
