import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { NabdSidebar } from "@/components/nabd-sidebar";
import { NabdHeader } from "@/components/nabd-header";
import { ChatInput } from "@/components/chat-input";
import { ChatMessages } from "@/components/chat-messages";
import type { Conversation, Message } from "@shared/schema";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
  });

  const createConversation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/conversations", { title });
      return res.json();
    },
    onSuccess: (data: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConversationId(data.id);
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, content, systemPrompt }: { conversationId: string; content: string; systemPrompt?: string }) => {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        content,
        role: "user",
        systemPrompt,
      });
      return res.json();
    },
    onSuccess: () => {
      if (activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId, "messages"] });
      }
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (activeConversationId) {
        setActiveConversationId(null);
      }
    },
  });

  const handleSend = useCallback(async (content: string, systemPrompt?: string) => {
    if (!activeConversationId) {
      const shortTitle = content.length > 30 ? content.slice(0, 30) + "..." : content;
      const conv = await createConversation.mutateAsync(shortTitle);
      await sendMessage.mutateAsync({ conversationId: conv.id, content, systemPrompt });
    } else {
      await sendMessage.mutateAsync({ conversationId: activeConversationId, content, systemPrompt });
    }
  }, [activeConversationId, createConversation, sendMessage]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const isInChat = !!activeConversationId;

  return (
    <div className="flex h-screen w-full" style={{ background: "#0a0a0a" }}>
      <div className="flex flex-col flex-1 min-w-0">
        <NabdHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          conversationTitle={activeConversation?.title}
        />

        {!isInChat ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="flex flex-col items-center mb-12 max-w-2xl">
              <h2
                className="text-5xl md:text-7xl font-extrabold text-white leading-[1.15] text-center mb-5"
                data-testid="text-hero-title"
              >
                مرحباً بك
                <br />
                في نبض.
              </h2>
              <p
                className="text-white/40 text-center text-lg md:text-xl leading-relaxed max-w-md"
                data-testid="text-hero-subtitle"
              >
                مساعدك الشخصي الذكي، جاهز لتنفيذ مهامك.
              </p>
            </div>

            <ChatInput
              onSend={handleSend}
              isLoading={sendMessage.isPending || createConversation.isPending}
              variant="hero"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <ChatMessages
              messages={messages}
              isLoading={sendMessage.isPending}
            />
            <ChatInput
              onSend={handleSend}
              isLoading={sendMessage.isPending}
              variant="chat"
            />
          </div>
        )}
      </div>

      <NabdSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewConversation={() => setActiveConversationId(null)}
        onDeleteConversation={(id) => deleteConversation.mutate(id)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}
