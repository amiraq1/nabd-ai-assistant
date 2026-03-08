import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Bell,
  BrainCircuit,
  Globe,
  Lock,
  Mail,
  Moon,
  Palette,
  Phone,
  Shield,
  Sliders,
  Sun,
  User,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Tab = "profile" | "ai" | "notifications" | "display" | "privacy";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "الملف الشخصي", icon: User },
  { id: "ai", label: "الذكاء الاصطناعي", icon: BrainCircuit },
  { id: "notifications", label: "الإشعارات", icon: Bell },
  { id: "display", label: "العرض", icon: Palette },
  { id: "privacy", label: "الخصوصية", icon: Shield },
];

function SettingRow({
  label,
  description,
  children,
  className
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group flex items-center justify-between gap-6 py-5 transition-all duration-300 hover:bg-white/[0.02] px-4 -mx-4 rounded-2xl", className)}>
      <div className="space-y-1.5 min-w-0 flex-1">
        <p className="text-[0.95rem] font-bold tracking-wide text-foreground group-hover:text-primary transition-colors">{label}</p>
        {description && (
          <p className="text-[0.8rem] text-foreground/45 leading-relaxed font-medium">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function UserPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // AI settings
  const [responseLength, setResponseLength] = useState([65]);
  const [creativityLevel, setCreativityLevel] = useState([50]);
  const [aiLanguage, setAiLanguage] = useState("ar");
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [smartSuggestions, setSmartSuggestions] = useState(true);
  const [codeMode, setCodeMode] = useState(false);

  // Notification settings
  const [notifConversation, setNotifConversation] = useState(true);
  const [notifUpdates, setNotifUpdates] = useState(false);
  const [notifWeeklyReport, setNotifWeeklyReport] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);

  // Display settings
  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState("medium");
  const [density, setDensity] = useState("comfortable");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [rtlLayout, setRtlLayout] = useState(true);

  // Privacy settings
  const [saveHistory, setSaveHistory] = useState(true);
  const [analyticsShare, setAnalyticsShare] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [dataExport, setDataExport] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("60");

  const tabVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    enter: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } 
    },
    exit: { 
      opacity: 0, 
      y: -10, 
      transition: { duration: 0.2, ease: "easeOut" } 
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background selection:bg-primary/20" dir="rtl">
      {/* Avant-Garde Background System */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.03),transparent_40%),radial-gradient(circle_at_bottom_left,hsl(var(--primary)/0.03),transparent_50%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen"
        style={{
          backgroundImage: "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[50vh] w-[50vw] rounded-full bg-accent/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-20%] right-[-10%] h-[60vh] w-[40vw] rounded-[100%] bg-primary/10 blur-[150px] rotate-45" />

      <main className="relative z-10 mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-16">
        {/* Header section designed with deliberate minimalism */}
        <header className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="space-y-3">
            <h1 className="hero-brand-title text-5xl md:text-6xl" data-testid="text-user-page-title">
              المركز
            </h1>
            <p className="text-lg font-medium tracking-wide text-foreground/40">الهندسة الخلفية لتجربتك مع نبضـ.</p>
          </div>
          <Button asChild variant="ghost" className="group h-12 rounded-2xl bg-white/[0.03] px-6 text-[0.95rem] font-bold text-foreground/60 hover:bg-white/10 hover:text-foreground transition-all duration-300">
            <Link href="/" data-testid="link-back-home">
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
              العودة للمقصد
            </Link>
          </Button>
        </header>

        <div className="grid gap-12 lg:grid-cols-[260px_1fr] items-start">
          {/* Navigation Sidebar - Premium Pill Design */}
          <nav className="relative flex flex-row gap-2 overflow-x-auto pb-4 lg:flex-col lg:overflow-visible lg:pb-0 hide-scrollbar">
            {TABS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  data-testid={`tab-${id}`}
                  className={cn(
                    "group relative flex items-center justify-center lg:justify-start gap-3 rounded-2xl px-5 py-3.5 text-[0.95rem] font-bold transition-all duration-300 shrink-0",
                    isActive ? "text-primary" : "text-foreground/50 hover:text-foreground/90 hover:bg-white/[0.02]"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 rounded-2xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_-5px_hsl(var(--primary)/0.2)]"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={cn("relative z-10 h-5 w-5 transition-transform duration-300", isActive && "scale-110")} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="relative z-10 hidden lg:inline tracking-wide">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Configuration Content Window */}
          <div className="relative min-h-[600px] w-full max-w-3xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={tabVariants}
                initial="hidden"
                animate="enter"
                exit="exit"
                className="rounded-[2.5rem] border border-white/5 bg-background/40 p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl md:p-12 relative overflow-hidden"
              >
                {/* Subtle highlight inside the panel */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* ── PROFILE TAB ── */}
                {activeTab === "profile" && (
                  <div className="space-y-12">
                    {/* Unique Profile Header */}
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                      <div className="relative group">
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-primary/60 to-accent/60 opacity-30 blur-xl transition-opacity group-hover:opacity-50" />
                        <Avatar className="h-32 w-32 border-2 border-white/10 ring-4 ring-background shadow-2xl transition-transform duration-500 group-hover:scale-105">
                          <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop" />
                          <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/30 text-2xl font-black text-primary">لع</AvatarFallback>
                        </Avatar>
                        <Button size="icon" className="absolute bottom-1 -right-1 h-10 w-10 rounded-full border-2 border-background shadow-lg transition-transform hover:scale-110">
                          <Palette className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex flex-col items-center text-center md:items-start md:text-start space-y-3 pt-2">
                        <h2 className="text-3xl font-black tracking-tight drop-shadow-sm">ليان العمري</h2>
                        <p className="text-[1.05rem] font-medium text-foreground/50 max-w-sm leading-relaxed">
                          مهندسة منتجات رقمية، تتنفس التفكير التصميمي، وتبني تجارب مستخدم تخاطب الوجدان.
                        </p>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                          <Badge className="rounded-xl px-3 py-1 font-bold bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">عضو نشط</Badge>
                          <Badge variant="outline" className="rounded-xl px-3 py-1 font-bold border-white/10 text-foreground/70">خطة احترافية</Badge>
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-white/5" />

                    {/* Architectural Contact Info */}
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.01] p-6 transition-all hover:bg-white/[0.03]">
                        <div className="absolute -right-4 -top-4 text-primary/5 transition-transform duration-500 group-hover:scale-110 group-hover:text-primary/10">
                          <Mail className="h-24 w-24" />
                        </div>
                        <div className="relative z-10">
                          <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-2 flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني
                          </p>
                          <p className="text-lg font-medium text-foreground/90">layan.omari@nabd.ai</p>
                        </div>
                      </div>
                      <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.01] p-6 transition-all hover:bg-white/[0.03]">
                        <div className="absolute -right-4 -top-4 text-primary/5 transition-transform duration-500 group-hover:scale-110 group-hover:text-primary/10">
                          <Phone className="h-24 w-24" />
                        </div>
                        <div className="relative z-10">
                          <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-2 flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5" /> الهاتف الموثق
                          </p>
                          <p className="text-lg font-medium text-foreground/90" dir="ltr">+966 50 123 4567</p>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid gap-5 sm:grid-cols-3">
                      {[
                        { label: "محادثات", value: "42", suffix: "" },
                        { label: "سرعة الرد", value: "1.8", suffix: "s" },
                        { label: "دقة الأداء", value: "96", suffix: "%" },
                      ].map((stat, i) => (
                        <div key={i} className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent py-6 text-center shadow-inner transition-all hover:border-primary/20">
                          <p className="text-xs font-bold text-foreground/40 mb-1">{stat.label}</p>
                          <p className="text-4xl font-black text-foreground drop-shadow-sm flex items-baseline gap-1">
                            {stat.value}<span className="text-lg text-primary">{stat.suffix}</span>
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button className="h-12 rounded-2xl bg-primary px-8 text-[0.95rem] font-bold shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)] transition-transform hover:scale-105">
                        حفظ التغييرات
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── AI SETTINGS TAB ── */}
                {activeTab === "ai" && (
                  <div className="space-y-8">
                    <div className="mb-8 space-y-2">
                      <h2 className="text-2xl font-black flex items-center gap-3">
                        <BrainCircuit className="h-6 w-6 text-primary" strokeWidth={2.5} />
                        محرك الذكاء
                      </h2>
                      <p className="text-foreground/40 font-medium">نحت شخصية الاستجابات لكي تتناغم مع وتيرة أفكارك.</p>
                    </div>

                    <div className="divide-y divide-white/5 border-y border-white/5 py-2">
                      <SettingRow label="لسان الآلة" description="اللغة التي يعتمدها النظام للتحليل المعرفي.">
                        <Select value={aiLanguage} onValueChange={setAiLanguage}>
                          <SelectTrigger className="w-[150px] h-11 rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/10 font-bold focus:ring-primary/50">
                            <Globe className="h-4 w-4 ml-2 text-primary" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
                            <SelectItem value="ar" className="rounded-xl font-bold">عربي</SelectItem>
                            <SelectItem value="en" className="rounded-xl font-bold">إنجليزي</SelectItem>
                            <SelectItem value="auto" className="rounded-xl font-bold">ذكي (تلقائي)</SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingRow>

                      <div className="py-6 space-y-5 px-4 -mx-4">
                        <div className="flex justify-between items-end">
                          <div className="space-y-1.5">
                            <Label className="text-[0.95rem] font-bold tracking-wide">كثافة المعلومات</Label>
                            <p className="text-[0.8rem] text-foreground/45 font-medium">تحكم في عمق الأجوبة وطولها.</p>
                          </div>
                          <Badge variant="outline" className="border-primary/30 text-primary font-black px-3 py-1 bg-primary/5 rounded-xl">
                            {responseLength[0]}%
                          </Badge>
                        </div>
                        <Slider value={responseLength} onValueChange={setResponseLength} min={10} max={100} step={5} className="w-full" />
                        <div className="flex justify-between text-[0.75rem] font-bold text-foreground/30">
                          <span>مُركّز ومختصر</span>
                          <span>مفصّل ومُسهب</span>
                        </div>
                      </div>

                      <div className="py-6 space-y-5 px-4 -mx-4">
                        <div className="flex justify-between items-end">
                          <div className="space-y-1.5">
                            <Label className="text-[0.95rem] font-bold tracking-wide">درجة الانحراف (Creativity)</Label>
                            <p className="text-[0.8rem] text-foreground/45 font-medium">مدى خروج الردود عن النسق المنطقي الصارم.</p>
                          </div>
                          <Badge variant="outline" className="border-primary/30 text-primary font-black px-3 py-1 bg-primary/5 rounded-xl">
                            {creativityLevel[0]}%
                          </Badge>
                        </div>
                        <Slider value={creativityLevel} onValueChange={setCreativityLevel} min={0} max={100} step={5} className="w-full" />
                        <div className="flex justify-between text-[0.75rem] font-bold text-foreground/30">
                          <span>رياضي / دقيق</span>
                          <span>فني / إبداعي</span>
                        </div>
                      </div>

                      <SettingRow label="التكثيف التلقائي" description="لخّص السياق الممتد لتوفير الذاكرة.">
                        <Switch checked={autoSummarize} onCheckedChange={setAutoSummarize} className="data-[state=checked]:bg-primary" />
                      </SettingRow>
                      
                      <SettingRow label="نمط الشيفرة (Code Mode)" description="تغليف الإجابات بتنسيق برمجي صارم وخالٍ من المجاملات.">
                        <Switch checked={codeMode} onCheckedChange={setCodeMode} className="data-[state=checked]:bg-primary" />
                      </SettingRow>
                    </div>
                  </div>
                )}

                {/* ── NOTIFICATIONS TAB ── */}
                {activeTab === "notifications" && (
                  <div className="space-y-8">
                    <div className="mb-8 space-y-2">
                      <h2 className="text-2xl font-black flex items-center gap-3">
                        <Bell className="h-6 w-6 text-primary" strokeWidth={2.5} />
                        الإشارات
                      </h2>
                      <p className="text-foreground/40 font-medium">قرر متى ولماذا يُقاطع نبضـ تركيزك.</p>
                    </div>

                    <div className="divide-y divide-white/5 border-y border-white/5 py-2">
                      <SettingRow label="النشاط الآني" description="رنين هادئ عند الانتهاء من توليد تحليل معقد.">
                        <Switch checked={notifConversation} onCheckedChange={setNotifConversation} className="data-[state=checked]:bg-primary" />
                      </SettingRow>
                      <SettingRow label="الرصد الأسبوعي" description="ملخص مُدرك لسلوكك وتفضيلاتك يصلك بنهاية الأسبوع.">
                        <Switch checked={notifWeeklyReport} onCheckedChange={setNotifWeeklyReport} className="data-[state=checked]:bg-primary" />
                      </SettingRow>
                      <SettingRow label="الاهتزاز الزجاجي (Haptics)" description="تردد استجابات حسيّة تزامن إشعارات الويب.">
                        <Switch checked={notifSound} onCheckedChange={setNotifSound} className="data-[state=checked]:bg-primary" />
                      </SettingRow>
                    </div>
                  </div>
                )}

                {/* ── DISPLAY TAB ── */}
                {activeTab === "display" && (
                  <div className="space-y-8">
                    <div className="mb-8 space-y-2">
                      <h2 className="text-2xl font-black flex items-center gap-3">
                        <Palette className="h-6 w-6 text-primary" strokeWidth={2.5} />
                        جماليات العرض
                      </h2>
                      <p className="text-foreground/40 font-medium">الحد الأدنى المتعمد. صمّم هيكلك البصري.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <button 
                        onClick={() => setTheme("dark")}
                        className={cn(
                          "relative overflow-hidden rounded-3xl border p-6 text-start transition-all duration-300",
                          theme === "dark" ? "border-primary/50 bg-primary/5 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] opacity-50 hover:opacity-100"
                        )}
                      >
                        <Moon className={cn("h-8 w-8 mb-4", theme === "dark" ? "text-primary" : "text-foreground/40")} />
                        <h3 className="font-bold text-lg mb-1">المحطة الليلية</h3>
                        <p className="text-xs text-foreground/40">غموض، تركيز عالي، تبياين حاد.</p>
                      </button>
                      <button 
                        onClick={() => setTheme("light")}
                        className={cn(
                          "relative overflow-hidden rounded-3xl border p-6 text-start transition-all duration-300",
                          theme === "light" ? "border-primary/50 bg-primary/5 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] opacity-50 hover:opacity-100"
                        )}
                      >
                        <Sun className={cn("h-8 w-8 mb-4", theme === "light" ? "text-primary" : "text-foreground/40")} />
                        <h3 className="font-bold text-lg mb-1">الوهج الساطع</h3>
                        <p className="text-xs text-foreground/40">نقاء، وضوح تام، ورؤية شاملة.</p>
                      </button>
                    </div>

                    <div className="divide-y divide-white/5 border-y border-white/5 py-2">
                      <SettingRow label="الهندسة المكانية (الكثافة)" description="مستوى ضغط المساحات السلبية.">
                        <Select value={density} onValueChange={setDensity}>
                          <SelectTrigger className="w-[150px] h-11 rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/10 font-bold focus:ring-primary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
                            <SelectItem value="compact" className="rounded-xl font-bold">مُكثّف</SelectItem>
                            <SelectItem value="comfortable" className="rounded-xl font-bold">متناغم</SelectItem>
                            <SelectItem value="spacious" className="rounded-xl font-bold">فارغ (مساحات ممتدة)</SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingRow>

                      <SettingRow label="تدفق الحركة (Animations)" description="تمكين العتاد وتأثيرات CSS/Framer المعمارية.">
                        <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} className="data-[state=checked]:bg-primary" />
                      </SettingRow>
                    </div>
                  </div>
                )}

                {/* ── PRIVACY TAB ── */}
                {activeTab === "privacy" && (
                  <div className="space-y-8">
                    <div className="mb-8 space-y-2">
                      <h2 className="text-2xl font-black flex items-center gap-3">
                        <Shield className="h-6 w-6 text-primary" strokeWidth={2.5} />
                        الجدار الأمني
                      </h2>
                      <p className="text-foreground/40 font-medium">سريتك مطلقة، أنت المتحكم الأول بآثار خطواتك الإفتراضية.</p>
                    </div>

                    <div className="divide-y divide-white/5 border-y border-white/5 py-2">
                      <SettingRow label="الذاكرة الطويلة" description="أرشفة المحُادثات وبناء قاعدة استدلال منها للردود القادمة.">
                        <Switch checked={saveHistory} onCheckedChange={setSaveHistory} className="data-[state=checked]:bg-primary" />
                      </SettingRow>
                      
                      <SettingRow label="التشفير المزدوج (2FA)" description="ربط الجلسة بمعزز أمني جانبي.">
                        <Switch checked={twoFactor} onCheckedChange={setTwoFactor} className="data-[state=checked]:bg-primary" />
                      </SettingRow>

                      <SettingRow label="عمر الجلسة (Session Decay)" description="الانهيار التلقائي لتصريح الدخول في حالة الركود.">
                        <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                          <SelectTrigger className="w-[140px] h-11 rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/10 font-bold focus:ring-primary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
                            <SelectItem value="15" className="rounded-xl font-bold">15 دقيقة</SelectItem>
                            <SelectItem value="60" className="rounded-xl font-bold">ساعة مرجعية</SelectItem>
                            <SelectItem value="never" className="rounded-xl font-bold">شاردة (لا تنتهي)</SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingRow>
                    </div>

                    <div className="pt-8">
                      <Button
                        variant="ghost"
                        className="w-full h-14 rounded-2xl border border-destructive/20 bg-destructive/5 text-[0.95rem] font-bold text-destructive hover:bg-destructive hover:text-white transition-all duration-300"
                      >
                        طمس الهوية الرقمية (حذف الحساب)
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
