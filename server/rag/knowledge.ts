export interface KnowledgeDocument {
  id: string;
  title: string;
  source: string;
  content: string;
}

export const KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: "nabd-capabilities",
    title: "قدرات Nabd الأساسية",
    source: "internal://nabd/capabilities",
    content:
      "Nabd AI Assistant يوفر محادثات عربية مع حفظ سياق المحادثة. " +
      "يدعم أنماط استخدام مثل الترجمة والبحث الذكي وإبداع المحتوى والتحويل الصوتي. " +
      "يمكنه استخدام أدوات خارجية لإحضار معلومات حديثة عند الحاجة.",
  },
  {
    id: "nabd-tooling",
    title: "أدوات Nabd",
    source: "internal://nabd/tools",
    content:
      "الأدوات المدمجة تشمل: weather لجلب حالة الطقس، web_search للبحث السريع، " +
      "و date_time للتاريخ والوقت الحاليين. " +
      "عند وجود طلب متعدد المهام يتم تقسيمه إلى خطوات ثم دمج النتائج في إجابة واحدة.",
  },
  {
    id: "nabd-guidelines",
    title: "إرشادات جودة الإجابة",
    source: "internal://nabd/guidelines",
    content:
      "الإجابة عالية الجودة يجب أن تكون مباشرة وواضحة، وتذكر القيود عند نقص البيانات، " +
      "وتتجنب الجزم بدون دليل. عند استخدام نتائج أدوات يجب عرضها بصيغة مفهومة " +
      "ثم تقديم خلاصة عملية للمستخدم.",
  },
];
