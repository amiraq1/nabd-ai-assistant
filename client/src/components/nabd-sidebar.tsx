import { useState } from "react";
import { MessageSquare, Plus, Settings, Trash2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Conversation } from "@shared/schema";

interface NabdSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function NabdSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isOpen,
  onClose,
}: NabdSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full z-50 w-72 transition-transform duration-300 ease-in-out",
          "border-l border-white/5 flex flex-col",
          "md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0 md:w-0 md:border-0 md:opacity-0 md:pointer-events-none"
        )}
        style={{ background: "#0e0e0e" }}
        data-testid="sidebar"
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-white" />
            <span className="text-white font-bold text-base">المحادثات</span>
          </div>
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            onClick={onClose}
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3">
          <button
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 border border-dashed border-white/10 text-white/50 text-sm transition-colors hover:border-white/20 hover:text-white/70 hover:bg-white/5"
            onClick={onNewConversation}
            data-testid="button-new-conversation"
          >
            <Plus className="w-4 h-4" />
            <span>محادثة جديدة</span>
          </button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-0.5 pb-4">
            {conversations.length === 0 && (
              <div className="text-center text-white/25 text-sm py-8">
                لا توجد محادثات بعد
              </div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200",
                  activeConversationId === conv.id
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
                onClick={() => onSelectConversation(conv.id)}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => setHoveredId(null)}
                data-testid={`conversation-item-${conv.id}`}
              >
                <MessageSquare className="w-4 h-4 shrink-0 opacity-50" />
                <span className="truncate text-sm flex-1">{conv.title}</span>
                {hoveredId === conv.id && (
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white/60"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    data-testid={`button-delete-conversation-${conv.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-white/30 cursor-pointer transition-colors hover:text-white/50 hover:bg-white/5">
            <Settings className="w-4 h-4" />
            <span className="text-sm">الإعدادات</span>
          </div>
        </div>
      </aside>
    </>
  );
}
