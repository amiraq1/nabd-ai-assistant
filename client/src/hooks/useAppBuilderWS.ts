import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeUIComponent, type UIComponent } from "@shared/ui-schema";

interface BuildStatusMessage {
  type: "BUILD_STATUS";
  status?: string;
}

interface BuildSuccessMessage {
  type: "BUILD_UI_SUCCESS";
  payload?: {
    schema?: unknown;
    projectId?: string;
    screenId?: string;
  };
}

interface BuildErrorMessage {
  type: "BUILD_UI_ERROR";
  error?: string;
}

type AppBuilderServerMessage =
  | BuildStatusMessage
  | BuildSuccessMessage
  | BuildErrorMessage;

function getAppBuilderWsUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/app-builder`;
}

function isServerMessage(value: unknown): value is AppBuilderServerMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  return typeof (value as { type?: unknown }).type === "string";
}

export function useAppBuilderWS() {
  const socketRef = useRef<WebSocket | null>(null);
  const queuedMessagesRef = useRef<string[]>([]);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);

  const [schema, setSchema] = useState<UIComponent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [screenId, setScreenId] = useState<string | null>(null);

  const flushQueuedMessages = useCallback((socket: WebSocket) => {
    if (socket.readyState !== WebSocket.OPEN || queuedMessagesRef.current.length === 0) {
      return;
    }

    for (const message of queuedMessagesRef.current) {
      socket.send(message);
    }

    queuedMessagesRef.current = [];
  }, []);

  useEffect(() => {
    const url = getAppBuilderWsUrl();
    if (!url) {
      return;
    }

    shouldReconnectRef.current = true;

    const connect = () => {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        flushQueuedMessages(socket);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as unknown;
          if (!isServerMessage(parsed)) {
            return;
          }

          if (parsed.type === "BUILD_STATUS" && parsed.status === "generating") {
            setIsGenerating(true);
            return;
          }

          if (parsed.type === "BUILD_UI_SUCCESS") {
            const nextSchema = normalizeUIComponent(parsed.payload?.schema);
            if (nextSchema) {
              setSchema(nextSchema);
            }
            setProjectId(
              typeof parsed.payload?.projectId === "string" ? parsed.payload.projectId : null,
            );
            setScreenId(
              typeof parsed.payload?.screenId === "string" ? parsed.payload.screenId : null,
            );
            setIsGenerating(false);
            return;
          }

          if (parsed.type === "BUILD_UI_ERROR") {
            console.error(parsed.error ?? "Unknown app builder error");
            setIsGenerating(false);
          }
        } catch (error) {
          console.error("Failed to parse app builder websocket message:", error);
          setIsGenerating(false);
        }
      };

      socket.onerror = () => {
        setIsGenerating(false);
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (!shouldReconnectRef.current) {
          return;
        }

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, 1000);
      };
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [flushQueuedMessages]);

  const sendPrompt = useCallback((text: string, currentSchema?: UIComponent | null) => {
    const prompt = text.trim();
    if (!prompt) {
      return;
    }

    const payload = JSON.stringify({
      type: "BUILD_UI_REQUEST",
      payload: {
        prompt,
        currentSchema: currentSchema ?? undefined,
      },
    });

    const socket = socketRef.current;
    setIsGenerating(true);

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(payload);
      return;
    }

    queuedMessagesRef.current.push(payload);
  }, []);

  return {
    schema,
    projectId,
    screenId,
    isGenerating,
    sendPrompt,
  };
}
