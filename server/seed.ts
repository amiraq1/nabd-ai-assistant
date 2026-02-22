import { db } from "./db";
import { conversations, messages } from "@shared/schema";

export async function seed() {
  const existing = await db.select().from(conversations).limit(1);
  if (existing.length > 0) return;

  const [conv1] = await db
    .insert(conversations)
    .values({ title: "كيف أتعلم البرمجة؟" })
    .returning();

  const [conv2] = await db
    .insert(conversations)
    .values({ title: "ترجمة مقال إلى العربية" })
    .returning();

  const [conv3] = await db
    .insert(conversations)
    .values({ title: "أفكار لمشروع تخرج" })
    .returning();

  await db.insert(messages).values([
    {
      conversationId: conv1.id,
      role: "user",
      content: "مرحباً، أريد أن أتعلم البرمجة من الصفر. من أين أبدأ؟",
    },
    {
      conversationId: conv1.id,
      role: "assistant",
      content:
        "مرحباً! سعيد بسماع رغبتك في تعلم البرمجة. أنصحك بالبدء بلغة Python لأنها سهلة التعلم وقوية في نفس الوقت. يمكنك البدء بمواقع مثل Codecademy أو freeCodeCamp، ثم الانتقال لبناء مشاريع صغيرة لتطبيق ما تعلمته.",
    },
    {
      conversationId: conv2.id,
      role: "user",
      content: "هل يمكنك ترجمة هذه الجملة: The future belongs to those who believe in the beauty of their dreams",
    },
    {
      conversationId: conv2.id,
      role: "assistant",
      content: "بالتأكيد! الترجمة هي: \"المستقبل ملك لأولئك الذين يؤمنون بجمال أحلامهم\". هذه مقولة شهيرة لإليانور روزفلت.",
    },
    {
      conversationId: conv3.id,
      role: "user",
      content: "أحتاج أفكار لمشروع تخرج في تخصص علوم الحاسب",
    },
    {
      conversationId: conv3.id,
      role: "assistant",
      content:
        "إليك بعض الأفكار الممتازة:\n\n١. نظام ذكي لإدارة المواعيد الطبية باستخدام الذكاء الاصطناعي\n٢. تطبيق للتعرف على النباتات من الصور\n٣. منصة تعليمية تفاعلية بتقنية الواقع المعزز\n٤. نظام كشف الاحتيال في المعاملات المالية\n٥. مساعد ذكي للطلاب يعتمد على معالجة اللغة الطبيعية",
    },
  ]);
}
