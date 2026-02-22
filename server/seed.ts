import { storage } from "./storage";

export async function seed() {
  const existing = await storage.getConversations();
  if (existing.length > 0) return;

  const conv1 = await storage.createConversation({ title: "كيف أتعلم البرمجة؟" });
  const conv2 = await storage.createConversation({ title: "ترجمة مقال إلى العربية" });
  const conv3 = await storage.createConversation({ title: "أفكار لمشروع تخرج" });

  await storage.createMessage({
    conversationId: conv1.id,
    role: "user",
    content: "مرحباً، أريد أن أتعلم البرمجة من الصفر. من أين أبدأ؟",
  });
  await storage.createMessage({
    conversationId: conv1.id,
    role: "assistant",
    content:
      "مرحباً! سعيد بسماع رغبتك في تعلم البرمجة. أنصحك بالبدء بلغة Python لأنها سهلة التعلم وقوية في نفس الوقت. يمكنك البدء بمواقع مثل Codecademy أو freeCodeCamp، ثم الانتقال لبناء مشاريع صغيرة لتطبيق ما تعلمته.",
  });

  await storage.createMessage({
    conversationId: conv2.id,
    role: "user",
    content: "هل يمكنك ترجمة هذه الجملة: The future belongs to those who believe in the beauty of their dreams",
  });
  await storage.createMessage({
    conversationId: conv2.id,
    role: "assistant",
    content: "بالتأكيد! الترجمة هي: \"المستقبل ملك لأولئك الذين يؤمنون بجمال أحلامهم\". هذه مقولة شهيرة لإليانور روزفلت.",
  });

  await storage.createMessage({
    conversationId: conv3.id,
    role: "user",
    content: "أحتاج أفكار لمشروع تخرج في تخصص علوم الحاسب",
  });
  await storage.createMessage({
    conversationId: conv3.id,
    role: "assistant",
    content:
      "إليك بعض الأفكار الممتازة:\n\n١. نظام ذكي لإدارة المواعيد الطبية باستخدام الذكاء الاصطناعي\n٢. تطبيق للتعرف على النباتات من الصور\n٣. منصة تعليمية تفاعلية بتقنية الواقع المعزز\n٤. نظام كشف الاحتيال في المعاملات المالية\n٥. مساعد ذكي للطلاب يعتمد على معالجة اللغة الطبيعية",
  });
}
