import { useState, useCallback, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { NabdSidebar } from "@/components/nabd-sidebar";
import { NabdHeader } from "@/components/nabd-header";
import { ChatInput } from "@/components/chat-input";
import { ChatMessages } from "@/components/chat-messages";
import type { Conversation, Message } from "@shared/schema";

interface SkillSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  samplePrompts: string[];
}

interface SkillsResponse {
  count: number;
  items: SkillSummary[];
}

interface PromptProfileSummary {
  id: string;
  label: string;
  description: string;
  promptLength: number;
}

interface PromptProfilesResponse {
  count: number;
  items: PromptProfileSummary[];
}

const QUICK_STARTS = [
  "ابنِ لي خطة تعلّم عملية لمدة 30 يومًا",
  "راجع هذا النص وقدم نسخة أوضح وأكثر إقناعًا",
  "ساعدني في تفكيك مشكلة تقنية مع خطوات تنفيذية",
];

const HeroSection = memo(
  ({
    onSend,
    isLoading,
    skills,
    promptProfiles,
  }: {
    onSend: (content: string, systemPromptId?: string) => void;
    isLoading: boolean;
    skills: SkillSummary[];
    promptProfiles: PromptProfileSummary[];
  }) => (
    <div className="flex-1 overflow-y-auto px-4 py-7 md:px-8 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 pt-10 pb-2 text-center">
          <h1 className="hero-brand-title" data-testid="text-hero-title">
            نبضـ
          </h1>
          <p className="text-base font-medium text-foreground/50 tracking-wide">
            ذكاء بلا ضجيج.
          </p>
        </div>
        <ChatInput
          onSend={onSend}
          isLoading={isLoading}
          variant="hero"
          promptProfiles={promptProfiles}
        />
      </div>
    </div>
  ),
);

HeroSection.displayName = "HeroSection";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: skillsResponse } = useQuery<SkillsResponse>({
    queryKey: ["/api/skills"],
  });

  const { data: promptProfilesResponse } = useQuery<PromptProfilesResponse>({
    queryKey: ["/api/ai/prompt-profiles"],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
  });

  const skills = skillsResponse?.items ?? [];
  const promptProfiles = promptProfilesResponse?.items ?? [];

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
    mutationFn: async ({
      conversationId,
      content,
      systemPromptId,
    }: {
      conversationId: string;
      content: string;
      systemPromptId?: string;
    }) => {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        content,
        role: "user",
        systemPromptId,
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
      return id;
    },
    onSuccess: (deletedId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
      }
    },
  });

  const handleSend = useCallback(async (content: string, systemPromptId?: string) => {
    if (!activeConversationId) {
      const shortTitle = content.length > 30 ? content.slice(0, 30) + "..." : content;
      const conv = await createConversation.mutateAsync(shortTitle);
      await sendMessage.mutateAsync({ conversationId: conv.id, content, systemPromptId });
    } else {
      await sendMessage.mutateAsync({ conversationId: activeConversationId, content, systemPromptId });
    }
  }, [activeConversationId, createConversation, sendMessage]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const isInChat = !!activeConversationId;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.12] mix-blend-screen"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 0%, hsl(var(--foreground)/0.12) 1.5%, transparent 3.5%, transparent 100%), linear-gradient(to right, hsl(var(--foreground)/0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)/0.08) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 24px 24px, 24px 24px",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-10 h-[320px] w-[320px] rounded-full bg-accent/30 blur-[90px]" />
      <div className="pointer-events-none absolute -right-28 bottom-12 h-[360px] w-[360px] rounded-full bg-primary/28 blur-[95px]" />

      <div className="z-10 flex min-w-0 flex-1 flex-col">
        <NabdHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          conversationTitle={activeConversation?.title}
        />

        {!isInChat ? (
          <HeroSection
            onSend={handleSend}
            isLoading={sendMessage.isPending || createConversation.isPending}
            skills={skills}
            promptProfiles={promptProfiles}
          />
        ) : (
          <div className="relative flex w-full min-h-0 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-col">
            <ChatMessages messages={messages} isLoading={sendMessage.isPending} />
            <ChatInput
              onSend={handleSend}
              isLoading={sendMessage.isPending || createConversation.isPending}
              variant="chat"
              promptProfiles={promptProfiles}
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
