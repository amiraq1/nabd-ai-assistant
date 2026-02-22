import { Link } from "wouter";
import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CalendarClock,
  Mail,
  Phone,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const stats = [
  { label: "محادثات هذا الأسبوع", value: "42" },
  { label: "متوسط سرعة الرد", value: "1.8s" },
  { label: "دقة المخرجات", value: "96%" },
];

const skillTags = [
  "تحليل المحتوى",
  "الترجمة",
  "كتابة إبداعية",
  "تلخيص ذكي",
  "تهيئة صوتية",
  "تدقيق لغوي",
];

function ProgressItem({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/75">{label}</span>
        <span className="font-semibold text-foreground">{value}%</span>
      </div>
      <Progress value={value} className="h-2.5 bg-white/10" />
    </div>
  );
}

export default function UserPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden relative" dir="rtl">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=%220 0 240 240%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22grain%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23grain)%22/%3E%3C/svg%3E")',
        }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[420px] w-[520px] rounded-full bg-primary/10 blur-[120px]" />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground" data-testid="text-user-page-title">
              صفحة المستخدم
            </h1>
            <p className="text-foreground/55">
              نظرة سريعة على ملفك الشخصي، التقدم، والإجراءات السريعة.
            </p>
          </div>
          <Button asChild variant="outline" className="border-white/15 bg-white/5 hover:bg-white/10">
            <Link href="/" data-testid="link-back-home">
              <ArrowRight className="h-4 w-4" />
              العودة للمحادثات
            </Link>
          </Button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-xl shadow-black/25">
            <CardHeader className="pb-5">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 ring-2 ring-primary/35">
                    <AvatarImage
                      alt="صورة المستخدم"
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop"
                    />
                    <AvatarFallback className="bg-primary/20 text-primary-foreground font-bold">
                      لع
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl md:text-3xl font-black tracking-tight">
                      ليان العمري
                    </CardTitle>
                    <CardDescription className="text-base text-foreground/60">
                      مهندسة منتجات رقمية تركز على تجربة المستخدم العربية.
                    </CardDescription>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-primary/90 text-primary-foreground">عضو نشط</Badge>
                      <Badge variant="secondary">خطة احترافية</Badge>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                  تقييم الجودة: 98/100
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <p className="text-xs text-foreground/55">{stat.label}</p>
                    <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{stat.value}</p>
                  </div>
                ))}
              </div>

              <Separator className="bg-white/10" />

              <div className="space-y-3">
                <h2 className="text-lg font-bold">بيانات التواصل</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-foreground/70">
                      <Mail className="h-4 w-4" />
                      <span className="text-sm">البريد الإلكتروني</span>
                    </div>
                    <p className="mt-2 text-sm font-medium">layan.omari@nabd.ai</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-foreground/70">
                      <Phone className="h-4 w-4" />
                      <span className="text-sm">رقم الجوال</span>
                    </div>
                    <p className="mt-2 text-sm font-medium">+966 5X XXX XXXX</p>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-end gap-3">
              <Button variant="outline" className="border-white/15 bg-transparent hover:bg-white/10">
                تحديث الصورة
              </Button>
              <Button>حفظ التغييرات</Button>
            </CardFooter>
          </Card>

          <div className="space-y-6">
            <Card className="border-white/10 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl">مؤشرات الحساب</CardTitle>
                <CardDescription>تقدم إعداد الحساب وجودة الاستخدام خلال الشهر الحالي.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressItem label="اكتمال الملف الشخصي" value={82} />
                <ProgressItem label="جاهزية مساحة العمل" value={91} />
                <ProgressItem label="تخصيص الأدوات" value={73} />
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl">مجالات الاستخدام</CardTitle>
                <CardDescription>المهام الأكثر نشاطًا في حسابك.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {skillTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-white/15 bg-white/[0.03] px-3 py-1">
                    {tag}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl">إجراءات سريعة</CardTitle>
                <CardDescription>اختصارات للمهام اليومية.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start border-white/15 bg-transparent hover:bg-white/10">
                  <Sparkles className="h-4 w-4" />
                  توليد موجز يومي
                </Button>
                <Button variant="outline" className="w-full justify-start border-white/15 bg-transparent hover:bg-white/10">
                  <BrainCircuit className="h-4 w-4" />
                  تحسين أسلوب الرد
                </Button>
                <Button variant="outline" className="w-full justify-start border-white/15 bg-transparent hover:bg-white/10">
                  <BookOpenText className="h-4 w-4" />
                  تصدير سجل التعلم
                </Button>
                <Button variant="outline" className="w-full justify-start border-white/15 bg-transparent hover:bg-white/10">
                  <CalendarClock className="h-4 w-4" />
                  جدولة تقرير أسبوعي
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
