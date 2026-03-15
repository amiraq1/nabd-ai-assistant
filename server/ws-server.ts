import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { randomUUID } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { generateAppSchema } from "./services/ai-architect.js";
import { storage } from "./storage.js";
import { USER_COOKIE_NAME, __sessionUserInternals } from "./auth/session-user.js";

const APP_BUILDER_PROJECT_NAME = "AI App Builder Workspace";
const MAX_SCREEN_NAME_CHARS = 255;

interface BuildUiRequestMessage {
  type: "BUILD_UI_REQUEST";
  payload?: {
    prompt?: string;
  };
}

function resolveSocketUserId(request: IncomingMessage): string {
  const cookies = __sessionUserInternals.parseCookieHeader(request.headers.cookie);
  const existing = cookies[USER_COOKIE_NAME];
  if (__sessionUserInternals.isLikelyUserId(existing)) {
    return existing;
  }

  return randomUUID();
}

function buildScreenName(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Generated Screen";
  }

  return normalized.slice(0, MAX_SCREEN_NAME_CHARS);
}

function safeSend(socket: WebSocket, payload: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function parseBuildRequest(message: string): BuildUiRequestMessage | null {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const value = parsed as Record<string, unknown>;
    if (value.type !== "BUILD_UI_REQUEST") {
      return null;
    }

    return {
      type: "BUILD_UI_REQUEST",
      payload:
        value.payload && typeof value.payload === "object"
          ? (value.payload as { prompt?: string })
          : undefined,
    };
  } catch {
    return null;
  }
}

let webSocketServer: WebSocketServer | null = null;

export function setupWebSocket(): void {
  if (webSocketServer) {
    return;
  }

  webSocketServer = new WebSocketServer({ noServer: true });

  webSocketServer.on("connection", (ws: WebSocket, request) => {
    console.log("App builder client connected");
    const userId = resolveSocketUserId(request);

    ws.on("message", async (rawMessage) => {
      const parsedMessage = parseBuildRequest(rawMessage.toString());
      if (!parsedMessage) {
        safeSend(ws, {
          type: "BUILD_UI_ERROR",
          error: "Invalid websocket message payload.",
        });
        return;
      }

      const userPrompt = parsedMessage.payload?.prompt?.trim();
      if (!userPrompt) {
        safeSend(ws, {
          type: "BUILD_UI_ERROR",
          error: "A prompt is required to build UI.",
        });
        return;
      }

      safeSend(ws, {
        type: "BUILD_STATUS",
        status: "generating",
      });

      try {
        await storage.ensureSessionUser(userId);
        const uiSchema = await generateAppSchema(userPrompt);
        const project = await storage.ensureProject(userId, APP_BUILDER_PROJECT_NAME, "web");
        const screen = await storage.createProjectScreen({
          projectId: project.id,
          name: buildScreenName(userPrompt),
          uiSchema,
          reactCode: "",
        });

        safeSend(ws, {
          type: "BUILD_UI_SUCCESS",
          payload: {
            schema: uiSchema,
            projectId: project.id,
            screenId: screen.id,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown app builder error";
        safeSend(ws, {
          type: "BUILD_UI_ERROR",
          error: message,
        });
      }
    });

    ws.on("close", () => {
      console.log("App builder client disconnected");
    });
  });
}

export function handleAppBuilderUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): boolean {
  if (!webSocketServer) {
    setupWebSocket();
  }

  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (pathname !== "/ws/app-builder" || !webSocketServer) {
    return false;
  }

  webSocketServer.handleUpgrade(request, socket, head, (client, incomingRequest) => {
    webSocketServer?.emit("connection", client, incomingRequest);
  });

  return true;
}
