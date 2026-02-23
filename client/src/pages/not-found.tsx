import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4" dir="rtl">
      <Card className="w-full max-w-md border-border/80 bg-card/85 shadow-xl shadow-black/10">
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">الصفحة غير موجودة</h1>
          </div>
          <p className="text-sm text-foreground/65">
            لم نتمكن من العثور على المسار المطلوب. يمكنك الرجوع إلى الصفحة الرئيسية.
          </p>
          <Button asChild className="w-full rounded-xl">
            <Link href="/">العودة إلى نبض</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
