import { Bot, Code, FileText, Image, Languages, Mic, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface BentoItem {
  icon: typeof Bot;
  title: string;
  description: string;
  span?: string;
}

const bentoItems: BentoItem[] = [
  {
    icon: Bot,
    title: "محادثة ذكية",
    description: "تحدث مع نبض واحصل على إجابات فورية ودقيقة",
    span: "md:col-span-2",
  },
  {
    icon: Code,
    title: "كتابة الأكواد",
    description: "مساعدة في البرمجة بجميع اللغات",
  },
  {
    icon: FileText,
    title: "تحليل النصوص",
    description: "تلخيص وتحليل المستندات بذكاء",
  },
  {
    icon: Image,
    title: "توليد الصور",
    description: "إنشاء صور إبداعية من النصوص",
  },
  {
    icon: Languages,
    title: "الترجمة",
    description: "ترجمة فورية بين عشرات اللغات",
  },
  {
    icon: Search,
    title: "البحث الذكي",
    description: "ابحث في الإنترنت واحصل على نتائج ملخصة",
    span: "md:col-span-2",
  },
  {
    icon: Mic,
    title: "التحويل الصوتي",
    description: "تحويل الصوت إلى نص والعكس",
  },
  {
    icon: Sparkles,
    title: "إبداع المحتوى",
    description: "كتابة مقالات وقصص وشعر بأسلوب متميز",
  },
];

interface BentoGridProps {
  onSelectTool: (title: string) => void;
}

export function BentoGrid({ onSelectTool }: BentoGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-3xl mx-auto px-4">
      {bentoItems.map((item) => (
        <div
          key={item.title}
          className={cn(
            "group relative rounded-2xl border border-border/40 p-5 cursor-pointer",
            "bg-card/60 backdrop-blur-sm",
            "transition-all duration-300",
            "hover:border-foreground/20 hover:bg-card",
            item.span
          )}
          onClick={() => onSelectTool(item.title)}
          data-testid={`bento-item-${item.title}`}
        >
          <div className="relative z-10">
            <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-foreground/5 text-foreground/70 group-hover:text-foreground transition-colors">
              <item.icon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
