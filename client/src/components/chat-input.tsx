import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, ChevronDown, Mic } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Separation of Concerns: يجب استخراج هذا لملف config مستقبلاً
const SYSTEM_PROMPTS: Record<string, string> = {
  "الترجمة": "أنت مترجم محترف. مهمتك هي ترجمة النص الذي يرسله المستخدم بدقة واحترافية عالية. لا تضف أي تعليقات أو شروحات، فقط أرسل الترجمة المباشرة.",
  "البحث الذكي": "أنت مساعد ذكي للبحث. قم بتحليل طلب المستخدم وقدم إجابة ملخصة، دقيقة، ومباشرة في نقاط واضحة.",
  "التحويل الصوتي": "أنت مساعد لتنسيق النصوص. قم بإعادة صياغة النص وتشكيله ليكون جاهزاً ومناسباً للقراءة الصوتية الآلية.",
  "إبداع المحتوى": "أنت كاتب محتوى مبدع ومحترف. قم بكتابة نصوص جذابة، مقالات، أو أفكار إبداعية بأسلوب ممتع بناءً على طلب المستخدم.",
};

const TOOL_KEYS = Object.keys(SYSTEM_PROMPTS);

interface ChatInputProps {
  onSend: (message: string, systemPrompt: string) => void;
  isLoading?: boolean;
  variant?: "hero" | "chat";
}

export function ChatInput({ onSend, isLoading, variant = "chat" }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedTool, setSelectedTool] = useState(TOOL_KEYS[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Performance: Auto-resize يقلل القفزات البصرية أثناء الكتابة
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  const handleSubmit = () => {
    if (!message.trim() || isLoading) return;
    onSend(message.trim(), SYSTEM_PROMPTS[selectedTool]);
    setMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isHero = variant === "hero";

  return (
    <div className={cn("w-full px-4 relative z-10", isHero ? "pb-0" : "sticky bottom-0 pb-6 pt-2")}>
      {/* Aesthetics: مساحة سلبية وظلال ناعمة بدلا من التحديد الحاد */}
      <div className={cn("mx-auto", isHero ? "max-w-3xl" : "max-w-4xl")}>
        <div
          className={cn(
            "relative group transition-all duration-500",
            "bg-[#110e17]/80 backdrop-blur-xl border border-white/5", // Glassmorphism دقيق
            isHero ? "rounded-[2rem] shadow-2xl shadow-purple-900/10" : "rounded-3xl shadow-lg",
            "focus-within:border-white/15 focus-within:bg-[#110e17]/95"
          )}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isHero ? "بمَ تُفكر اليوم؟" : "اكتب لتبدأ النبض..."}
            rows={1}
            dir="auto" // Accessibility: Auto يكتشف الاتجاه طبيعياً
            className={cn(
              "w-full bg-transparent text-foreground placeholder:text-foreground/40",
              "resize-none outline-none font-medium tracking-wide",
              isHero ? "px-6 pt-6 pb-20 text-lg rounded-[2rem]" : "px-5 pt-5 pb-16 text-base rounded-3xl"
            )}
            aria-label="رسالة المستخدم"
            data-testid="input-chat-message"
          />

          <div
            className={cn(
              "absolute left-4 right-4 flex items-center justify-between gap-3",
              isHero ? "bottom-5" : "bottom-4"
            )}
          >
            <div className="flex items-center gap-2">
              <button
                aria-label="إرفاق ملف"
                data-testid="button-attach"
                className="flex items-center justify-center w-10 h-10 rounded-2xl text-foreground/40 transition-all hover:text-foreground hover:bg-white/10"
              >
                <Paperclip className="w-5 h-5" strokeWidth={1.5} />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="تحديد الأداة"
                    data-testid="dropdown-tool-trigger"
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 text-foreground/70 text-sm font-semibold transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    <span>{selectedTool}</span>
                    <ChevronDown className="w-4 h-4 opacity-50" strokeWidth={2} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px] rounded-2xl bg-[#110e17] border-white/10 backdrop-blur-xl">
                  {TOOL_KEYS.map((tool) => (
                    <DropdownMenuItem
                      key={tool}
                      onClick={() => setSelectedTool(tool)}
                      data-testid={`dropdown-item-${tool}`}
                      className={cn(
                        "cursor-pointer text-sm font-medium py-2.5 rounded-xl transition-colors",
                        selectedTool === tool && "bg-primary/20 text-primary focus:bg-primary/30"
                      )}
                    >
                      {tool}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <button
                aria-label="إدخال صوتي"
                data-testid="button-mic"
                className="flex items-center justify-center w-10 h-10 rounded-2xl text-foreground/40 transition-all hover:text-foreground hover:bg-white/10"
              >
                <Mic className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <button
                aria-label="إرسال"
                data-testid="button-send-message"
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300",
                  message.trim()
                    ? "bg-foreground text-background scale-100 shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 cursor-pointer"
                    : "bg-white/5 text-foreground/20 scale-95 cursor-not-allowed"
                )}
                onClick={handleSubmit}
                disabled={!message.trim() || isLoading}
              >
                {/* Motion: حيوية في الرموز */}
                <Send className={cn("w-5 h-5 rotate-180", message.trim() && "animate-in slide-in-from-bottom-2")} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
