import { useState, useCallback, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { NabdSidebar } from "@/components/nabd-sidebar";
import { NabdHeader } from "@/components/nabd-header";
import { ChatInput } from "@/components/chat-input";
import { ChatMessages } from "@/components/chat-messages";
import type { Conversation, Message } from "@shared/schema";

// Separation of Concerns & Performance:
// فصل شاشة الترحيب كمكون مستقل لتجنب إعادة تصييرها مع أي تحديث (Re-render) في حالة المحادثة الرئيسية.
const HeroSection = memo(({
  onSend,
  isLoading
}: {
  onSend: (content: string, systemPrompt?: string) => void;
  isLoading: boolean;
}) => (
  <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10 w-full animate-in fade-in duration-1000">
    <div className="flex flex-col items-center mb-16 max-w-2xl text-center space-y-6">
      {/* الجماليات: تدرجات ضوئية، تباين عالي، وتوهج سينمائي للخط */}
      <h2
        className="hero-brand-title"
        data-testid="text-hero-title"
      >
        نبضـ.
      </h2>
      <p
        className="hero-brand-subtitle"
        data-testid="text-hero-subtitle"
      >
        مساعدك المرجعي،{" "}
        <span className="hero-brand-focus">جاهز للتفكير.</span>
      </p>
    </div>

    <ChatInput
      onSend={onSend}
      isLoading={isLoading}
      variant="hero"
    />
  </div>
));

HeroSection.displayName = "HeroSection";


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
    // الخلفية: اعتماد نظام الألوان الجديد من Tailwind، وإلغاء Inline Styles العشوائية
    <div className="flex h-screen w-full bg-background overflow-hidden relative">

      {/* التفاصيل البصرية: تراكبات الحبوب (Noise/Grain Texture) والإضاءة المنتشرة */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
      ></div>
      <div className="absolute top-0 right-1/4 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0 mix-blend-screen isolate opacity-60"></div>

      <div className="flex flex-col flex-1 min-w-0 z-10">
        <NabdHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          conversationTitle={activeConversation?.title}
        />

        {!isInChat ? (
          <HeroSection
            onSend={handleSend}
            isLoading={sendMessage.isPending || createConversation.isPending}
          />
        ) : (
          <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full relative">
            {/* مساحة المحادثة النشطة (Chat Mode) */}
            <ChatMessages
              messages={messages}
              isLoading={sendMessage.isPending}
            />
            <div className="relative w-full pb-4">
              <ChatInput
                onSend={handleSend}
                isLoading={sendMessage.isPending}
                variant="chat"
              />
            </div>
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
