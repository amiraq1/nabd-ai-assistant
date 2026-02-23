import {
  Bot,
  Code,
  FileText,
  Image,
  Languages,
  Mic,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillCard {
  id: string;
  name: string;
  description: string;
  category: string;
  samplePrompts?: string[];
}

interface BentoItem {
  icon: typeof Bot;
  title: string;
  description: string;
  prompt: string;
  tone: string;
  span?: string;
}

const fallbackItems: BentoItem[] = [
  {
    icon: Bot,
    title: "محادثة ذكية",
    description: "تحويل الأسئلة المفتوحة إلى إجابة منظمة بخطوات واضحة.",
    prompt: "أريد إجابة منظمة لسؤالي مع خطوات تنفيذ واضحة.",
    tone: "from-primary/18 via-primary/10 to-transparent",
    span: "md:col-span-4",
  },
  {
    icon: Code,
    title: "كتابة الأكواد",
    description: "حلول عملية مع تركيز على بنية الكود وقابلية الصيانة.",
    prompt: "ساعدني في كتابة كود نظيف وقابل للتوسع مع شرح مختصر للقرار.",
    tone: "from-primary/16 via-transparent to-transparent",
  },
  {
    icon: FileText,
    title: "تحليل النصوص",
    description: "استخراج الفكرة الأساسية وإعادة الصياغة بدقة لغوية.",
    prompt: "حلّل النص التالي واستخرج أهم النقاط بترتيب أولويات.",
    tone: "from-primary/14 via-transparent to-transparent",
  },
  {
    icon: Search,
    title: "البحث الذكي",
    description: "تجميع سريع للمعلومة مع خلاصة موجزة قابلة للتنفيذ.",
    prompt: "ابحث في الموضوع التالي وقدّم خلاصة قصيرة مع نقاط عملية.",
    tone: "from-primary/18 via-primary/8 to-transparent",
    span: "md:col-span-4",
  },
  {
    icon: Languages,
    title: "الترجمة",
    description: "ترجمة دقيقة تحافظ على النبرة والسياق المهني.",
    prompt: "ترجم النص التالي مع الحفاظ على النبرة والسياق المهني.",
    tone: "from-primary/12 via-transparent to-transparent",
  },
  {
    icon: Mic,
    title: "التحويل الصوتي",
    description: "تهيئة النص ليصبح واضحًا عند القراءة الصوتية.",
    prompt: "أعد صياغة هذا النص ليصبح مناسبًا للقراءة الصوتية الآلية.",
    tone: "from-primary/12 via-transparent to-transparent",
  },
  {
    icon: Image,
    title: "وصف بصري",
    description: "بناء أوصاف بصرية دقيقة قابلة للتحويل إلى مخرجات إبداعية.",
    prompt: "اكتب وصفًا بصريًا احترافيًا لمشهد إبداعي قابل للتوليد.",
    tone: "from-primary/12 via-transparent to-transparent",
  },
  {
    icon: Sparkles,
    title: "إبداع المحتوى",
    description: "أفكار وصياغات إبداعية متوازنة بين الجاذبية والوضوح.",
    prompt: "اكتب قطعة محتوى إبداعية بنبرة احترافية وجذابة.",
    tone: "from-primary/16 via-primary/6 to-transparent",
  },
];

const categoryIcon: Record<string, typeof Bot> = {
  utility: Bot,
  knowledge: Search,
  economy: Sparkles,
  geo: FileText,
  news: Search,
  culture: Languages,
  arabic: Sparkles,
};

const tones = [
  "from-primary/20 via-primary/10 to-transparent",
  "from-primary/16 via-transparent to-transparent",
  "from-primary/14 via-transparent to-transparent",
  "from-primary/18 via-primary/8 to-transparent",
  "from-primary/12 via-transparent to-transparent",
  "from-primary/15 via-primary/6 to-transparent",
];

function buildDynamicItems(skills: SkillCard[]): BentoItem[] {
  return skills.slice(0, 8).map((skill, index) => ({
    icon: categoryIcon[skill.category] ?? Bot,
    title: skill.name,
    description: skill.description,
    prompt:
      skill.samplePrompts?.[0] ??
      `استخدم مهارة ${skill.name} لحل هذا الطلب بشكل عملي ومباشر.`,
    tone: tones[index % tones.length],
    span: index % 5 === 0 ? "md:col-span-4" : undefined,
  }));
}

interface BentoGridProps {
  onSelectTool: (title: string) => void;
  skills?: SkillCard[];
}

export function BentoGrid({ onSelectTool, skills = [] }: BentoGridProps) {
  const items = skills.length > 0 ? buildDynamicItems(skills) : fallbackItems;

  return (
    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-8">
      {items.map((item) => (
        <button
          type="button"
          key={item.title}
          className={cn(
            "group rork-panel hover-rise relative overflow-hidden rounded-[1.7rem] p-5 text-right",
            "backdrop-blur-sm",
            "transition-all duration-300",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
            item.span,
          )}
          onClick={() => onSelectTool(item.prompt)}
          data-testid={`bento-item-${item.title}`}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
              item.tone,
            )}
          />
          <div className="relative z-10">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background/75 text-foreground/70 transition-colors group-hover:border-primary/35 group-hover:text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <h3 className="mb-1 text-base font-bold text-foreground">{item.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
