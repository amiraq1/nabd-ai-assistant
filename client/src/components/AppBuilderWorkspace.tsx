import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Download, LoaderCircle, Save, Smartphone, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { ChatInput, type PromptProfileOption } from "@/components/chat-input";
import { ChatMessages } from "@/components/chat-messages";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useToast } from "@/hooks/use-toast";
import { useAppBuilderWS } from "@/hooks/useAppBuilderWS";
import type { Message } from "@shared/schema";
import type { UIComponent } from "@shared/ui-schema";

const APP_BUILDER_CONVERSATION_ID = "app-builder";

interface AppBuilderWorkspaceProps {
  routeProjectId?: string;
  initialProjectName?: string;
  initialUiSchema?: UIComponent | null;
}

interface SavedProjectResponse {
  id: string;
  name: string;
  createdAt: string;
}

function createLocalMessage(role: Message["role"], content: string): Message {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `builder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    conversationId: APP_BUILDER_CONVERSATION_ID,
    role,
    content,
    createdAt: new Date(),
  };
}

const BUILDER_PROFILE: PromptProfileOption[] = [
  {
    id: "app_builder",
    label: "مهندس التطبيقات",
    description: "توليد واجهات وهياكل النظام اللحظية.",
  },
];

const WorkspaceStatus = memo(
  ({
    isEditingExistingProject,
    projectName,
  }: {
    isEditingExistingProject: boolean;
    projectName: string;
  }) => (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-border/80 bg-background/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/58">
        {isEditingExistingProject ? "Editing saved app" : "New app draft"}
      </span>
      {projectName ? (
        <span className="max-w-full truncate text-sm font-semibold text-foreground/76">
          {projectName}
        </span>
      ) : null}
    </div>
  ),
);

WorkspaceStatus.displayName = "WorkspaceStatus";

const MobileFrame = memo(
  ({
    schema,
    isGenerating,
    isCopying,
    isExporting,
    isSaving,
    onCopyCode,
    onExport,
    onSaveProject,
  }: {
    schema: UIComponent | null;
    isGenerating: boolean;
    isCopying: boolean;
    isExporting: boolean;
    isSaving: boolean;
    onCopyCode: () => void;
    onExport: () => void;
    onSaveProject: () => void;
  }) => (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.16)]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">
            العرض المباشر
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border/80 bg-background/45 px-2.5 py-1 text-[11px] font-semibold text-foreground/50">
            جوال (Mobile)
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onSaveProject}
            disabled={!schema || isGenerating || isSaving || isCopying || isExporting}
            className="h-8 rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
          >
            {isSaving ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            حفظ المشروع
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopyCode}
            disabled={!schema || isGenerating || isSaving || isCopying || isExporting}
            className="h-8 rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
          >
            {isCopying ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            نسخ الشيفرة
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!schema || isGenerating || isSaving || isCopying || isExporting}
            className="h-8 rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
          >
            {isExporting ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            تصدير
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-6 md:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 16%, hsl(var(--primary)/0.22), transparent 28%), radial-gradient(circle at 82% 88%, hsl(var(--accent)/0.22), transparent 32%)",
          }}
        />

        <div className="relative flex h-full w-full max-w-[420px] items-center justify-center">
          <div className="pointer-events-none absolute inset-x-8 top-5 h-16 rounded-full bg-primary/18 blur-3xl" />
          <div className="relative w-full max-w-[350px] rounded-[2.1rem] border border-border/80 bg-card/65 p-2 shadow-[0_22px_44px_-26px_hsl(0_0%_0%_/_0.9)] backdrop-blur-xl">
            <div className="relative aspect-[9/19.5] overflow-hidden rounded-[1.75rem] border border-border/65 bg-white shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.82)] dark:bg-card">
              <div className="absolute inset-x-0 top-0 h-10 border-b border-border/55 bg-background/75 backdrop-blur-md" />
              <div className="absolute left-1/2 top-2.5 h-1.5 w-16 -translate-x-1/2 rounded-full bg-foreground/18" />

              {schema ? (
                <div className="relative h-full overflow-y-auto px-4 pb-4 pt-14">
                  <WidgetRenderer schema={schema} />
                </div>
              ) : (
                <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="rounded-2xl border border-primary/25 bg-primary/12 p-3 text-primary">
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground/80">
                    مساحة الرسم المعمارية
                  </p>
                  <p className="max-w-[220px] text-xs leading-6 text-foreground/55">
                    صِف واجهة التطبيق، أرسل التوجيه، وراقب البناء يتم بصورة فورية.
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/72 backdrop-blur-md">
                  <div className="rounded-2xl border border-primary/30 bg-primary/12 p-4 text-primary shadow-[0_18px_40px_-24px_hsl(var(--primary)/0.85)]">
                    <LoaderCircle className="h-6 w-6 animate-spin" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-sm font-bold tracking-wide text-foreground/85">جارٍ صياغة الواجهة...</p>
                    <p className="text-xs text-foreground/55">
                      سيتم تحديث العرض فور اكتمال الهيكل (Schema).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  ),
);

MobileFrame.displayName = "MobileFrame";

export default function AppBuilderWorkspace({
  routeProjectId,
  initialProjectName = "",
  initialUiSchema = null,
}: AppBuilderWorkspaceProps) {
  const { schema, screenId, isGenerating, sendPrompt } = useAppBuilderWS();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [projectName, setProjectName] = useState(initialProjectName);
  const [uiSchema, setUiSchema] = useState<UIComponent | null>(initialUiSchema);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    createLocalMessage(
      "assistant",
      "صِف التطبيق أو الواجهة التي تطمح لبنائها. سأقوم بتوليد هيكل واجهة المستخدم وتحديث العرض الفوري لك.",
    ),
  ]);
  const lastSchemaRef = useRef<UIComponent | null>(null);
  const isEditingExistingProject = Boolean(routeProjectId);

  useEffect(() => {
    if (!schema || schema === lastSchemaRef.current) {
      return;
    }

    lastSchemaRef.current = schema;
    setUiSchema(schema);
    setMessages((current) => [
      ...current,
      createLocalMessage(
        "assistant",
        "تم تحديث العرض. أرسل توجيهات إضافية لتنقيح التخطيط، تنسيق الألوان، والتفاصيل البصرية للمكونات.",
      ),
    ]);
  }, [schema]);

  const handleSend = useCallback(
    (text: string) => {
      const prompt = text.trim();
      if (!prompt) {
        return;
      }

      setMessages((current) => [...current, createLocalMessage("user", prompt)]);
      sendPrompt(prompt, uiSchema);
    },
    [sendPrompt, uiSchema],
  );

  const requestExportedCode = useCallback(async () => {
    if (!uiSchema) {
      throw new Error("يجب توليد واجهة قبل محاولة تصدير الشيفرة.");
    }

    const response = await fetch("/api/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonSchema: uiSchema,
        screenId,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      let message = "فشل في تصدير شيفرة React الموّلدة.";

      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as { message?: string };
        if (payload.message) {
          message = payload.message;
        }
      } else {
        const text = (await response.text()).trim();
        if (text) {
          message = text;
        }
      }

      throw new Error(message);
    }

    return response.text();
  }, [screenId, uiSchema]);

  const copyToClipboard = useCallback(async (code: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = code;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("تعذر الوصول للحافظة في هذا المتصفح.");
    }
  }, []);

  const handleCopyCode = useCallback(async () => {
    if (!uiSchema || isGenerating || isSaving || isCopying || isExporting) {
      return;
    }

    setIsCopying(true);

    try {
      const code = await requestExportedCode();
      await copyToClipboard(code);

      toast({
        title: "اكتمل النسخ",
        description: "تم نسخ شيفرة React بنجاح إلى الحافظة.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "فشل في نسخ شيفرة React الموّلدة.";
      toast({
        variant: "destructive",
        title: "فشل النسخ",
        description: message,
      });
    } finally {
      setIsCopying(false);
    }
  }, [
    copyToClipboard,
    isCopying,
    isExporting,
    isGenerating,
    isSaving,
    requestExportedCode,
    toast,
    uiSchema,
  ]);

  const handleExport = useCallback(async () => {
    if (!uiSchema || isGenerating || isSaving || isCopying || isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const code = await requestExportedCode();
      const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "GeneratedApp.tsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      toast({
        title: "اكتمل التصدير",
        description: "تم تحميل ملف GeneratedApp.tsx بنجاح.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "فشل في تصدير شيفرة React الموّلدة.";
      toast({
        variant: "destructive",
        title: "فشل التصدير",
        description: message,
      });
    } finally {
      setIsExporting(false);
    }
  }, [isCopying, isExporting, isGenerating, isSaving, requestExportedCode, toast, uiSchema]);

  const handleSaveProject = useCallback(async () => {
    if (!uiSchema || isGenerating || isSaving || isCopying || isExporting) {
      return;
    }

    const requestedName = window.prompt("اسم لتسمية هذا المشروع الابتكاري:");
    const nextProjectName = requestedName?.trim();
    const projectName = nextProjectName;

    if (!nextProjectName) {
      return;
    }

    setIsSaving(true);

    try {
      const isUpdatingExistingProject = Boolean(routeProjectId);
      const projectEndpoint = isUpdatingExistingProject
        ? `/api/projects/${routeProjectId}`
        : "/api/projects";
      const response = await fetch(projectEndpoint, {
        method: isUpdatingExistingProject ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextProjectName,
          uiSchema,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "فشل النظام في حفظ المشروع.");
      }

      const savedProject = (await response.json()) as SavedProjectResponse;
      queryClient.setQueryData<SavedProjectResponse[]>(["/api/projects"], (current = []) => {
        const nextProjects = current.filter((project) => project.id !== savedProject.id);
        return [
          {
            id: savedProject.id,
            name: savedProject.name,
            createdAt: savedProject.createdAt,
          },
          ...nextProjects,
        ];
      });
      queryClient.setQueryData(["/api/projects", savedProject.id], {
        id: savedProject.id,
        name: savedProject.name,
        createdAt: savedProject.createdAt,
        uiSchema,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setProjectName(savedProject.name);

      if (!isUpdatingExistingProject) {
        setLocation(`/workspace/${savedProject.id}`);
      }

      toast({
        title: "تم توثيق المشروع بنجاح!",
        description: `أصبح "${projectName}" جزءاً من أرشيف ابتكاراتك.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "تعذر الحفظ",
        description:
          error instanceof Error ? error.message : "فشل النظام في حفظ المشروع.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    isCopying,
    isExporting,
    isGenerating,
    isSaving,
    queryClient,
    routeProjectId,
    setLocation,
    toast,
    uiSchema,
  ]);

  const promptProfiles = useMemo(() => BUILDER_PROFILE, []);

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.12] mix-blend-screen"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 0%, hsl(var(--foreground)/0.12) 1.5%, transparent 3.5%, transparent 100%), linear-gradient(to right, hsl(var(--foreground)/0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)/0.08) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 24px 24px, 24px 24px",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-10 h-[320px] w-[320px] rounded-full bg-accent/30 blur-[90px]" />
      <div className="pointer-events-none absolute -right-28 bottom-12 h-[360px] w-[360px] rounded-full bg-primary/28 blur-[95px]" />

      <div className="z-10 flex min-w-0 flex-1 flex-col">
        <div className="hidden min-h-0 flex-1 md:flex">
          <ResizablePanelGroup
            direction="horizontal"
            autoSaveId="app-builder-workspace-layout"
            className="min-h-0"
          >
            <ResizablePanel defaultSize={34} minSize={28} maxSize={48} className="min-w-0">
              <div className="flex h-full min-h-0 flex-col border-r border-border/70 bg-background/45">
                <div className="border-b border-border/70 px-5 py-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      هندسة التطبيقات عبر الذكاء
                    </span>
                  </div>
                  <h1 className="mt-3 text-2xl font-black tracking-tight text-foreground">
                    مختبر التصميم (Prompt-to-UI)
                  </h1>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-foreground/60 font-medium">
                    استخدم المحادثة لتوليد شاشات معمارية وتفحص النتيجة في المعاينة الحية.
                  </p>
                  <WorkspaceStatus
                    isEditingExistingProject={isEditingExistingProject}
                    projectName={projectName}
                  />
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col">
                  <ChatMessages messages={messages} isLoading={isGenerating} />
                  <ChatInput
                    onSend={handleSend}
                    isLoading={isGenerating}
                    variant="chat"
                    promptProfiles={promptProfiles}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-border/70" />

            <ResizablePanel defaultSize={66} minSize={52}>
              <div className="h-full bg-background/30">
                <MobileFrame
                  schema={uiSchema}
                  isGenerating={isGenerating}
                  isCopying={isCopying}
                  isExporting={isExporting}
                  isSaving={isSaving}
                  onCopyCode={handleCopyCode}
                  onExport={handleExport}
                  onSaveProject={handleSaveProject}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:hidden">
          <div className="min-h-0 basis-[44%] border-b border-border/70 bg-background/32">
            <MobileFrame
              schema={uiSchema}
              isGenerating={isGenerating}
              isCopying={isCopying}
              isExporting={isExporting}
              isSaving={isSaving}
              onCopyCode={handleCopyCode}
              onExport={handleExport}
              onSaveProject={handleSaveProject}
            />
          </div>
          <div className="flex min-h-0 basis-[56%] flex-col bg-background/45">
            <div className="border-b border-border/70 px-4 py-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  هندسة التطبيقات عبر الذكاء
                </span>
              </div>
              <WorkspaceStatus
                isEditingExistingProject={isEditingExistingProject}
                projectName={projectName}
              />
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col">
              <ChatMessages messages={messages} isLoading={isGenerating} />
              <ChatInput
                onSend={handleSend}
                isLoading={isGenerating}
                variant="chat"
                promptProfiles={promptProfiles}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
