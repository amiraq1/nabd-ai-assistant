import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, ChevronDown, Mic } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const systemPrompts: Record<string, string> = {
  "الترجمة": "أنت مترجم محترف. مهمتك هي ترجمة النص الذي يرسله المستخدم بدقة واحترافية عالية. لا تضف أي تعليقات أو شروحات، فقط أرسل الترجمة المباشرة.",
  "البحث الذكي": "أنت مساعد ذكي للبحث. قم بتحليل طلب المستخدم وقدم إجابة ملخصة، دقيقة، ومباشرة في نقاط واضحة.",
  "التحويل الصوتي": "أنت مساعد لتنسيق النصوص. قم بإعادة صياغة النص وتشكيله ليكون جاهزاً ومناسباً للقراءة الصوتية الآلية.",
  "إبداع المحتوى": "أنت كاتب محتوى مبدع ومحترف. قم بكتابة نصوص جذابة، مقالات، أو أفكار إبداعية بأسلوب ممتع بناءً على طلب المستخدم.",
};

const toolKeys = Object.keys(systemPrompts);

interface ChatInputProps {
  onSend: (message: string, systemPrompt: string) => void;
  isLoading?: boolean;
  variant?: "hero" | "chat";
}

export function ChatInput({ onSend, isLoading, variant = "chat" }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedTool, setSelectedTool] = useState("الترجمة");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [message]);

  const handleSubmit = () => {
    if (!message.trim() || isLoading) return;
    const payload = {
      message: message.trim(),
      systemPrompt: systemPrompts[selectedTool],
      selectedTool,
    };
    console.log("Nabd payload:", payload);
    onSend(message.trim(), systemPrompts[selectedTool]);
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isHero = variant === "hero";

  return (
    <div className={cn(
      "w-full px-4",
      isHero ? "pb-0" : "sticky bottom-0 pb-4 pt-2"
    )}>
      <div className={cn("mx-auto", isHero ? "max-w-2xl" : "max-w-3xl")}>
        <div
          className={cn(
            "relative border transition-all duration-300",
            isHero
              ? "rounded-3xl bg-[#1a1a1a] border-white/10 shadow-2xl shadow-black/40"
              : "rounded-2xl bg-[#1a1a1a] border-white/10"
          )}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isHero ? "...صف ما تريد إنشاءه" : "...اكتب رسالتك هنا"}
            rows={1}
            dir="rtl"
            className={cn(
              "w-full bg-transparent text-white placeholder:text-white/30",
              "resize-none outline-none",
              isHero
                ? "px-5 pt-5 pb-16 text-base leading-relaxed rounded-3xl"
                : "px-4 pt-4 pb-14 text-sm leading-relaxed rounded-2xl"
            )}
            data-testid="input-chat-message"
          />

          <div className={cn(
            "absolute left-3 right-3 flex items-center justify-between gap-2",
            isHero ? "bottom-4" : "bottom-3"
          )}>
            <div className="flex items-center gap-1.5">
              <button
                className="flex items-center justify-center w-8 h-8 rounded-xl text-white/40 transition-colors hover:text-white/60 hover:bg-white/5"
                data-testid="button-attach"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-white/60 text-xs font-medium transition-colors hover:bg-white/10 cursor-pointer outline-none"
                    data-testid="dropdown-tool-trigger"
                  >
                    <span>{selectedTool}</span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  {toolKeys.map((tool) => (
                    <DropdownMenuItem
                      key={tool}
                      onClick={() => setSelectedTool(tool)}
                      className={cn(
                        "cursor-pointer text-sm",
                        selectedTool === tool && "bg-foreground/10 font-medium"
                      )}
                      data-testid={`dropdown-item-${tool}`}
                    >
                      {tool}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                className="flex items-center justify-center w-8 h-8 rounded-xl text-white/40 transition-colors hover:text-white/60 hover:bg-white/5"
                data-testid="button-mic"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200",
                  message.trim()
                    ? "bg-white text-black cursor-pointer hover:bg-white/90"
                    : "bg-white/10 text-white/20 cursor-default"
                )}
                onClick={handleSubmit}
                disabled={!message.trim() || isLoading}
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
