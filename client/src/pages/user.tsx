import { useState } from "react";
import { Link } from "wouter";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-foreground/50 leading-relaxed">{description}</p>
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-background" dir="rtl">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-screen"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--foreground)/0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)/0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="pointer-events-none absolute -top-28 right-1/4 h-[420px] w-[520px] rounded-full bg-accent/26 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-8 left-10 h-[280px] w-[280px] rounded-full bg-primary/24 blur-[100px]" />

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif text-4xl font-black leading-none text-foreground md:text-5xl" data-testid="text-user-page-title">
              الإعدادات
            </h1>
            <p className="text-foreground/55">تحكم كامل في تجربتك مع نبضـ</p>
          </div>
          <Button asChild variant="outline" className="rounded-2xl border-border/80 bg-card/70 hover:bg-card">
            <Link href="/" data-testid="link-back-home">
              <ArrowRight className="h-4 w-4" />
              العودة للمحادثات
            </Link>
          </Button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Sidebar Tabs */}
          <nav className="flex flex-row gap-1 lg:flex-col">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                data-testid={`tab-${id}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 text-start",
                  activeTab === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground/65 hover:bg-card hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="space-y-4">

            {/* ── PROFILE ── */}
            {activeTab === "profile" && (
              <>
                <Card className="border-border/80 bg-card/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle>الملف الشخصي</CardTitle>
                    <CardDescription>معلوماتك الأساسية وبيانات التواصل</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20 ring-2 ring-primary/35 ring-offset-2 ring-offset-background">
                        <AvatarImage
                          alt="صورة المستخدم"
                          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop"
                        />
                        <AvatarFallback className="bg-primary/20 font-bold text-primary">لع</AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <p className="text-xl font-black">ليان العمري</p>
                        <p className="text-sm text-foreground/55">مهندسة منتجات رقمية تركز على تجربة المستخدم العربية.</p>
                        <div className="flex gap-2">
                          <Badge className="rounded-full bg-primary text-primary-foreground">عضو نشط</Badge>
                          <Badge variant="secondary" className="rounded-full">خطة احترافية</Badge>
                        </div>
                      </div>
                    </div>
                    <Separator className="bg-border/60" />
                    {/* Contact */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/75 bg-background/55 p-4">
                        <div className="flex items-center gap-2 text-foreground/60 mb-2">
                          <Mail className="h-4 w-4" />
                          <span className="text-xs">البريد الإلكتروني</span>
                        </div>
                        <p className="text-sm font-medium">layan.omari@nabd.ai</p>
                      </div>
                      <div className="rounded-2xl border border-border/75 bg-background/55 p-4">
                        <div className="flex items-center gap-2 text-foreground/60 mb-2">
                          <Phone className="h-4 w-4" />
                          <span className="text-xs">رقم الجوال</span>
                        </div>
                        <p className="text-sm font-medium">+966 5X XXX XXXX</p>
                      </div>
                    </div>
                    {/* Stats */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { label: "محادثات هذا الأسبوع", value: "42" },
                        { label: "متوسط سرعة الرد", value: "1.8s" },
                        { label: "دقة المخرجات", value: "96%" },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-2xl border border-border/75 bg-background/55 px-4 py-3">
                          <p className="text-xs text-foreground/50">{stat.label}</p>
                          <p className="mt-1 text-2xl font-black tracking-tight">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" className="rounded-2xl border-border/80">تحديث الصورة</Button>
                  <Button className="rounded-2xl">حفظ التغييرات</Button>
                </div>
              </>
            )}

            {/* ── AI SETTINGS ── */}
            {activeTab === "ai" && (
              <Card className="border-border/80 bg-card/80 backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <CardTitle>إعدادات الذكاء الاصطناعي</CardTitle>
                  </div>
                  <CardDescription>تحكم في سلوك نبضـ وأسلوب إجاباته</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border/50">
                  <SettingRow
                    label="لغة الذكاء الاصطناعي"
                    description="اللغة الأساسية للإجابات والتحليل"
                  >
                    <Select value={aiLanguage} onValueChange={setAiLanguage}>
                      <SelectTrigger className="w-[140px] rounded-xl border-border/80 bg-background/55">
                        <Globe className="h-3.5 w-3.5 ml-1 text-foreground/50" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="en">الإنجليزية</SelectItem>
                        <SelectItem value="auto">تلقائي</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>

                  <div className="py-4 space-y-3">
                    <Label className="text-sm font-semibold">طول الإجابة</Label>
                    <p className="text-xs text-foreground/50">
                      {responseLength[0] < 35 ? "مختصرة جداً" : responseLength[0] < 60 ? "متوازنة" : "مفصّلة"}
                      {" — "}{responseLength[0]}%
                    </p>
                    <Slider
                      value={responseLength}
                      onValueChange={setResponseLength}
                      min={10} max={100} step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-foreground/35">
                      <span>مختصرة</span>
                      <span>مفصّلة</span>
                    </div>
                  </div>

                  <div className="py-4 space-y-3">
                    <Label className="text-sm font-semibold">مستوى الإبداع</Label>
                    <p className="text-xs text-foreground/50">
                      {creativityLevel[0] < 35 ? "دقيق وحرفي" : creativityLevel[0] < 65 ? "متوازن" : "إبداعي وحر"}
                      {" — "}{creativityLevel[0]}%
                    </p>
                    <Slider
                      value={creativityLevel}
                      onValueChange={setCreativityLevel}
                      min={0} max={100} step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-foreground/35">
                      <span>دقيق</span>
                      <span>إبداعي</span>
                    </div>
                  </div>

                  <SettingRow
                    label="التلخيص التلقائي"
                    description="يلخّص المحادثات الطويلة تلقائياً"
                  >
                    <Switch checked={autoSummarize} onCheckedChange={setAutoSummarize} />
                  </SettingRow>
                  <SettingRow
                    label="الاقتراحات الذكية"
                    description="يقترح متابعة السياق وأسئلة ذات صلة"
                  >
                    <Switch checked={smartSuggestions} onCheckedChange={setSmartSuggestions} />
                  </SettingRow>
                  <SettingRow
                    label="وضع الكود"
                    description="يُفعّل التنسيق التقني والبرمجي تلقائياً"
                  >
                    <Switch checked={codeMode} onCheckedChange={setCodeMode} />
                  </SettingRow>
                </CardContent>
              </Card>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === "notifications" && (
              <Card className="border-border/80 bg-card/80 backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    <CardTitle>إعدادات الإشعارات</CardTitle>
                  </div>
                  <CardDescription>تحكم في ما يُشعرك به نبضـ ومتى</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border/50">
                  <SettingRow
                    label="إشعارات المحادثات"
                    description="تنبيهات عند بدء أو استكمال محادثة"
                  >
                    <Switch checked={notifConversation} onCheckedChange={setNotifConversation} />
                  </SettingRow>
                  <SettingRow
                    label="التحديثات والميزات الجديدة"
                    description="أخبار عن آخر تحديثات نبضـ"
                  >
                    <Switch checked={notifUpdates} onCheckedChange={setNotifUpdates} />
                  </SettingRow>
                  <SettingRow
                    label="التقرير الأسبوعي"
                    description="ملخص أسبوعي لنشاطك وإحصاءاتك"
                  >
                    <Switch checked={notifWeeklyReport} onCheckedChange={setNotifWeeklyReport} />
                  </SettingRow>
                  <SettingRow
                    label="الصوت والاهتزاز"
                    description="أصوات عند وصول الإشعارات"
                  >
                    <Switch checked={notifSound} onCheckedChange={setNotifSound} />
                  </SettingRow>
                  <SettingRow
                    label="إشعارات البريد الإلكتروني"
                    description="استقبال ملخصات على بريدك الإلكتروني"
                  >
                    <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
                  </SettingRow>
                </CardContent>
              </Card>
            )}

            {/* ── DISPLAY ── */}
            {activeTab === "display" && (
              <Card className="border-border/80 bg-card/80 backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-primary" />
                    <CardTitle>إعدادات العرض</CardTitle>
                  </div>
                  <CardDescription>خصّص مظهر الواجهة وأسلوب العرض</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border/50">
                  <SettingRow label="المظهر" description="اختر بين الوضع الليلي والنهاري">
                    <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-background/55 p-1">
                      <button
                        onClick={() => setTheme("light")}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                          theme === "light" ? "bg-primary text-primary-foreground" : "text-foreground/50 hover:text-foreground"
                        )}
                      >
                        <Sun className="h-3.5 w-3.5" /> نهاري
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                          theme === "dark" ? "bg-primary text-primary-foreground" : "text-foreground/50 hover:text-foreground"
                        )}
                      >
                        <Moon className="h-3.5 w-3.5" /> ليلي
                      </button>
                    </div>
                  </SettingRow>

                  <SettingRow label="حجم الخط" description="اضبط حجم النصوص في الواجهة">
                    <Select value={fontSize} onValueChange={setFontSize}>
                      <SelectTrigger className="w-[130px] rounded-xl border-border/80 bg-background/55">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">صغير</SelectItem>
                        <SelectItem value="medium">متوسط</SelectItem>
                        <SelectItem value="large">كبير</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>

                  <SettingRow label="كثافة العناصر" description="المسافة بين العناصر في الواجهة">
                    <Select value={density} onValueChange={setDensity}>
                      <SelectTrigger className="w-[140px] rounded-xl border-border/80 bg-background/55">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">مضغوط</SelectItem>
                        <SelectItem value="comfortable">مريح</SelectItem>
                        <SelectItem value="spacious">واسع</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>

                  <SettingRow label="الحركات والانتقالات" description="تفعيل تأثيرات الحركة في الواجهة">
                    <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} />
                  </SettingRow>

                  <SettingRow label="اتجاه RTL" description="تخطيط من اليمين إلى اليسار">
                    <Switch checked={rtlLayout} onCheckedChange={setRtlLayout} />
                  </SettingRow>
                </CardContent>
              </Card>
            )}

            {/* ── PRIVACY ── */}
            {activeTab === "privacy" && (
              <Card className="border-border/80 bg-card/80 backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <CardTitle>الخصوصية والأمان</CardTitle>
                  </div>
                  <CardDescription>تحكم في بياناتك وحماية حسابك</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border/50">
                  <SettingRow
                    label="حفظ سجل المحادثات"
                    description="الاحتفاظ بتاريخ محادثاتك على الخادم"
                  >
                    <Switch checked={saveHistory} onCheckedChange={setSaveHistory} />
                  </SettingRow>

                  <SettingRow
                    label="مشاركة بيانات التحليل"
                    description="مساعدتنا في تحسين نبضـ بشكل مجهول"
                  >
                    <Switch checked={analyticsShare} onCheckedChange={setAnalyticsShare} />
                  </SettingRow>

                  <SettingRow
                    label="المصادقة الثنائية (2FA)"
                    description="حماية إضافية عبر رمز التحقق عند الدخول"
                  >
                    <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
                  </SettingRow>

                  <SettingRow
                    label="مهلة انتهاء الجلسة"
                    description="تسجيل الخروج تلقائياً بعد فترة خمول"
                  >
                    <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                      <SelectTrigger className="w-[140px] rounded-xl border-border/80 bg-background/55">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 دقيقة</SelectItem>
                        <SelectItem value="30">30 دقيقة</SelectItem>
                        <SelectItem value="60">ساعة واحدة</SelectItem>
                        <SelectItem value="never">لا تنتهي</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>

                  <SettingRow
                    label="تصدير بياناتك"
                    description="تنزيل نسخة كاملة من بياناتك الشخصية"
                  >
                    <Switch checked={dataExport} onCheckedChange={setDataExport} />
                  </SettingRow>

                  <div className="pt-4">
                    <Button
                      variant="outline"
                      className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive/60"
                    >
                      حذف الحساب نهائياً
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
