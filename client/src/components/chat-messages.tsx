import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@shared/schema";
import { useEffect, useRef } from "react";

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "flex gap-3 items-start",
            msg.role === "user" ? "flex-row-reverse" : "flex-row"
          )}
          data-testid={`message-${msg.id}`}
        >
          <div
            className={cn(
              "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center",
              msg.role === "user"
                ? "bg-[#2a1f4e] text-purple-200"
                : "bg-[#1a1a1a] border border-white/10 text-white/70"
            )}
          >
            {msg.role === "user" ? (
              <User className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>
          <div
            className={cn(
              "rounded-2xl px-4 py-3 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap",
              msg.role === "user"
                ? "bg-[#1e1635] border border-purple-500/15 text-purple-100"
                : "bg-[#1a1a1a] border border-white/10 text-white/80"
            )}
          >
            {msg.content}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex gap-3 items-start" data-testid="message-loading">
          <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[#1a1a1a] border border-white/10 text-white/70">
            <Bot className="w-4 h-4" />
          </div>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3">
            <div className="flex gap-2 items-center">
              <span className="text-sm text-white/50">نبض يفكر...</span>
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
