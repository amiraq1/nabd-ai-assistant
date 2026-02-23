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
      <Progress value={value} className="h-2.5 bg-border/65" />
    </div>
  );
}

export default function UserPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background" dir="rtl">
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

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif text-5xl leading-none text-foreground md:text-6xl" data-testid="text-user-page-title">
              صفحة المستخدم
            </h1>
            <p className="text-foreground/62">
              نظرة سريعة على ملفك الشخصي، التقدم، والإجراءات السريعة.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-2xl border-border/80 bg-card/70 hover:bg-card">
            <Link href="/" data-testid="link-back-home">
              <ArrowRight className="h-4 w-4" />
              العودة للمحادثات
            </Link>
          </Button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <Card className="border-border/80 bg-card/80 shadow-xl shadow-black/10 backdrop-blur-xl">
            <CardHeader className="pb-5">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 ring-2 ring-primary/35 ring-offset-2 ring-offset-background">
                    <AvatarImage
                      alt="صورة المستخدم"
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop"
                    />
                    <AvatarFallback className="bg-primary/20 font-bold text-primary">
                      لع
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl font-black tracking-tight md:text-3xl">
                      ليان العمري
                    </CardTitle>
                    <CardDescription className="text-base text-foreground/62">
                      مهندسة منتجات رقمية تركز على تجربة المستخدم العربية.
                    </CardDescription>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-primary text-primary-foreground">عضو نشط</Badge>
                      <Badge variant="secondary" className="rounded-full border border-secondary/30 bg-secondary/[0.12] text-secondary">
                        خطة احترافية
                      </Badge>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                  تقييم الجودة: 98/100
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-border/75 bg-background/55 px-4 py-3"
                  >
                    <p className="text-xs text-foreground/58">{stat.label}</p>
                    <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{stat.value}</p>
                  </div>
                ))}
              </div>

              <Separator className="bg-border/70" />

              <div className="space-y-3">
                <h2 className="text-lg font-bold">بيانات التواصل</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/75 bg-background/55 p-4">
                    <div className="flex items-center gap-2 text-foreground/70">
                      <Mail className="h-4 w-4" />
                      <span className="text-sm">البريد الإلكتروني</span>
                    </div>
                    <p className="mt-2 text-sm font-medium">layan.omari@nabd.ai</p>
                  </div>
                  <div className="rounded-2xl border border-border/75 bg-background/55 p-4">
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
              <Button variant="outline" className="rounded-2xl border-border/80 bg-transparent hover:bg-card">
                تحديث الصورة
              </Button>
              <Button className="rounded-2xl">حفظ التغييرات</Button>
            </CardFooter>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/80 bg-card/80 backdrop-blur-xl">
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

            <Card className="border-border/80 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl">مجالات الاستخدام</CardTitle>
                <CardDescription>المهام الأكثر نشاطًا في حسابك.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {skillTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="rounded-full border-border/75 bg-background/55 px-3 py-1">
                    {tag}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl">إجراءات سريعة</CardTitle>
                <CardDescription>اختصارات للمهام اليومية.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start rounded-xl border-border/75 bg-transparent hover:bg-card">
                  <Sparkles className="h-4 w-4" />
                  توليد موجز يومي
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl border-border/75 bg-transparent hover:bg-card">
                  <BrainCircuit className="h-4 w-4" />
                  تحسين أسلوب الرد
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl border-border/75 bg-transparent hover:bg-card">
                  <BookOpenText className="h-4 w-4" />
                  تصدير سجل التعلم
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl border-border/75 bg-transparent hover:bg-card">
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
