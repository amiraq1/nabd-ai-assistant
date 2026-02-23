import { useState } from "react";
import { MessageSquare, Plus, Settings, Trash2, UserRound, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Conversation } from "@shared/schema";
import { Link } from "wouter";

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
          className="fixed inset-0 z-40 bg-foreground/26 backdrop-blur-[2px] md:hidden"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-80 border-l border-border/80 bg-sidebar/96 backdrop-blur-xl transition-transform duration-300 ease-in-out",
          "flex flex-col",
          "md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0 md:w-0 md:border-0 md:opacity-0 md:pointer-events-none"
        )}
        data-testid="sidebar"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]" />
            <span className="text-base font-bold text-sidebar-foreground">المحادثات</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground md:hidden"
            onClick={onClose}
            data-testid="button-close-sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-3">
          <Button
            variant="outline"
            className="w-full justify-center gap-2 rounded-2xl border-dashed border-border/85 bg-transparent py-2.5 text-sm text-sidebar-foreground/76 hover-rise hover:bg-sidebar-accent/35 hover:text-sidebar-foreground"
            onClick={onNewConversation}
            data-testid="button-new-conversation"
          >
            <Plus className="h-4 w-4" />
            <span>محادثة جديدة</span>
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-0.5 pb-4">
            {conversations.length === 0 && (
              <div className="py-8 text-center text-sm text-sidebar-foreground/35">
                لا توجد محادثات بعد
              </div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-2xl border border-transparent px-3 py-2.5 transition-all duration-200",
                  activeConversationId === conv.id
                    ? "border-primary/24 bg-sidebar-accent/56 text-sidebar-foreground shadow-[0_12px_20px_-14px_hsl(var(--primary)/0.6)]"
                    : "text-sidebar-foreground/55 hover:border-primary/20 hover:bg-sidebar-accent/32 hover:text-sidebar-foreground"
                )}
                onClick={() => onSelectConversation(conv.id)}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => setHoveredId(null)}
                data-testid={`conversation-item-${conv.id}`}
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-65" />
                <span className="truncate text-sm flex-1">{conv.title}</span>
                {hoveredId === conv.id && (
                  <button
                    className="text-sidebar-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
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

        <div className="border-t border-border/70 p-3">
          <div className="space-y-1">
            <Link
              href="/user"
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sidebar-foreground/55 transition-colors hover:border-primary/20 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
              data-testid="link-user-page"
            >
              <UserRound className="w-4 h-4" />
              <span className="text-sm">صفحة المستخدم</span>
            </Link>
            <div className="flex cursor-default items-center gap-2 rounded-xl px-3 py-2.5 text-sidebar-foreground/35">
              <Settings className="w-4 h-4" />
              <span className="text-sm">الإعدادات</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
