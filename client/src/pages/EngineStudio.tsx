import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  Bug,
  FileCode2,
  FileJson2,
  FolderOutput,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Rocket,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useLocation } from "wouter";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { AppBlueprint, GeneratedAppBundle, GeneratedFile } from "@shared/app-blueprint";

interface BlueprintResponse {
  blueprint: AppBlueprint;
}

interface MaterializeResponse {
  rootPath: string;
  absolutePath: string;
  fileCount: number;
}

const PROMPT_PLACEHOLDER =
  "Build a multi-tenant inventory platform with product catalog, stock adjustments, purchase orders, role-based admin screens, and a responsive analytics dashboard.";

const CODE_PANEL_CLASS =
  "rounded-[1.75rem] border border-white/10 bg-stone-950/90 p-4 font-mono text-[12px] leading-6 text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function GenerationMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
      <div className={cn("text-[11px] font-semibold uppercase tracking-[0.24em]", accent)}>{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</div>
    </div>
  );
}

function EmptyResultState() {
  return (
    <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <CardContent className="flex min-h-[460px] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-5 rounded-[1.6rem] border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-100">
          <Sparkles className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          The engine is waiting for a prompt.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">
          Generate a planning blueprint first, or jump straight to a full bundle to inspect the
          API surface, generated files, UI schema, and deployment scaffold in one pass.
        </p>
      </CardContent>
    </Card>
  );
}

function JsonPanel({ value }: { value: unknown }) {
  return (
    <ScrollArea className="h-[560px] rounded-[1.75rem] border border-white/10 bg-stone-950/75">
      <pre className="p-5 font-mono text-[12px] leading-6 text-stone-200">{prettyJson(value)}</pre>
    </ScrollArea>
  );
}

function DiagnosticsPanel({ bundle }: { bundle: GeneratedAppBundle | null }) {
  if (!bundle) {
    return (
      <Card className="border-white/10 bg-white/[0.03]">
        <CardContent className="px-6 py-10 text-sm text-white/55">
          Diagnostics appear after a full bundle generation pass.
        </CardContent>
      </Card>
    );
  }

  if (bundle.diagnostics.length === 0) {
    return (
      <Card className="border-emerald-400/20 bg-emerald-400/10">
        <CardContent className="flex items-center gap-3 px-6 py-8 text-emerald-100">
          <Bug className="h-5 w-5" />
          No diagnostics were emitted after the compile sanity pass.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bundle.diagnostics.map((diagnostic) => (
        <Card
          key={`${diagnostic.filePath}-${diagnostic.message}`}
          className={cn(
            "border-white/10 bg-white/[0.03]",
            diagnostic.severity === "error" && "border-rose-400/30 bg-rose-400/10",
            diagnostic.severity === "warning" && "border-amber-400/30 bg-amber-400/10",
          )}
        >
          <CardContent className="space-y-3 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]",
                  diagnostic.severity === "error" && "border-rose-300/25 text-rose-100",
                  diagnostic.severity === "warning" && "border-amber-300/25 text-amber-100",
                  diagnostic.severity === "info" && "border-cyan-300/25 text-cyan-100",
                )}
              >
                {diagnostic.severity}
              </Badge>
              <span className="font-mono text-xs text-white/62">{diagnostic.filePath}</span>
            </div>
            <p className="text-sm leading-7 text-white/78">{diagnostic.message}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FilesPanel({
  files,
  selectedFilePath,
  onSelect,
}: {
  files: GeneratedFile[];
  selectedFilePath: string | null;
  onSelect: (filePath: string) => void;
}) {
  const selectedFile = files.find((file) => file.path === selectedFilePath) ?? files[0] ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <ScrollArea className="h-[560px] rounded-[1.75rem] border border-white/10 bg-white/[0.03]">
        <div className="space-y-2 p-3">
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelect(file.path)}
              className={cn(
                "w-full rounded-[1.25rem] border px-4 py-3 text-left transition-colors",
                selectedFile?.path === file.path
                  ? "border-cyan-300/30 bg-cyan-300/12 text-white"
                  : "border-transparent bg-white/[0.025] text-white/72 hover:border-white/10 hover:bg-white/[0.05]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{file.path.split("/").at(-1)}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-white/42">{file.path}</div>
                </div>
                <Badge variant="outline" className="rounded-full border-white/10 bg-black/20 text-[10px] uppercase tracking-[0.2em] text-white/60">
                  {file.kind}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      {selectedFile ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="rounded-full border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
              {selectedFile.language}
            </Badge>
            <span className="font-mono text-xs text-white/55">{selectedFile.path}</span>
          </div>
          <ScrollArea className="h-[520px] rounded-[1.75rem] border border-white/10 bg-stone-950/80">
            <pre className="p-5 font-mono text-[12px] leading-6 text-stone-200">
              {selectedFile.content}
            </pre>
          </ScrollArea>
        </div>
      ) : null}
    </div>
  );
}

export default function EngineStudio() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const bootRequest = useMemo(() => {
    if (typeof window === "undefined") {
      return { prompt: "", autostart: null as "blueprint" | "bundle" | null };
    }

    const params = new URLSearchParams(window.location.search);
    const prompt = params.get("prompt")?.trim() ?? "";
    const autostart = params.get("autostart");

    return {
      prompt,
      autostart:
        autostart === "blueprint" || autostart === "bundle"
          ? autostart
          : (null as "blueprint" | "bundle" | null),
    };
  }, []);
  const bootHandledRef = useRef(false);
  const [prompt, setPrompt] = useState(() => bootRequest.prompt);
  const [currentBlueprint, setCurrentBlueprint] = useState<AppBlueprint | null>(null);
  const [bundle, setBundle] = useState<GeneratedAppBundle | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [useCurrentBlueprint, setUseCurrentBlueprint] = useState(true);
  const [materializedApp, setMaterializedApp] = useState<MaterializeResponse | null>(null);

  const effectiveBlueprint = bundle?.blueprint ?? currentBlueprint;

  const summary = useMemo(
    () => ({
      entities: effectiveBlueprint?.entities.length ?? 0,
      endpoints: effectiveBlueprint?.endpoints.length ?? 0,
      pages: effectiveBlueprint?.pages.length ?? 0,
      files: bundle?.files.length ?? 0,
      diagnostics: bundle?.diagnostics.length ?? 0,
    }),
    [bundle, effectiveBlueprint],
  );

  useEffect(() => {
    if (!bundle?.files.length) {
      setSelectedFilePath(null);
      return;
    }

    setSelectedFilePath((current) =>
      current && bundle.files.some((file) => file.path === current) ? current : bundle.files[0].path,
    );
  }, [bundle]);

  const blueprintMutation = useMutation({
    mutationFn: async (payload: { prompt: string; currentBlueprint?: AppBlueprint | null }) => {
      const response = await apiRequest("POST", "/api/ai/engine/blueprint", payload);
      return (await response.json()) as BlueprintResponse;
    },
    onSuccess: ({ blueprint }) => {
      setCurrentBlueprint(blueprint);
      setBundle(null);
      setMaterializedApp(null);
      toast({
        title: "Blueprint updated",
        description: `${blueprint.entities.length} entities and ${blueprint.endpoints.length} endpoints are now in memory.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Blueprint generation failed",
        description: error instanceof Error ? error.message : "The engine could not build the DSL.",
      });
    },
  });

  const bundleMutation = useMutation({
    mutationFn: async (payload: { prompt: string; currentBlueprint?: AppBlueprint | null }) => {
      const response = await apiRequest("POST", "/api/ai/engine/generate", payload);
      return (await response.json()) as GeneratedAppBundle;
    },
    onSuccess: (nextBundle) => {
      setBundle(nextBundle);
      setCurrentBlueprint(nextBundle.blueprint);
      setMaterializedApp(null);
      toast({
        title: "Bundle generated",
        description: `${nextBundle.files.length} files and ${nextBundle.diagnostics.length} diagnostics were returned.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Bundle generation failed",
        description:
          error instanceof Error ? error.message : "The engine could not generate the scaffold bundle.",
      });
    },
  });

  const materializeMutation = useMutation({
    mutationFn: async (payload: { bundle: GeneratedAppBundle }) => {
      const response = await apiRequest("POST", "/api/ai/engine/materialize", payload);
      return (await response.json()) as MaterializeResponse;
    },
    onSuccess: (result) => {
      setMaterializedApp(result);
      toast({
        title: "Files exported",
        description: `${result.fileCount} files were written to ${result.rootPath}.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Export failed",
        description:
          error instanceof Error ? error.message : "The generated files could not be written.",
      });
    },
  });

  const currentMutationPending = blueprintMutation.isPending || bundleMutation.isPending;

  useEffect(() => {
    if (bootHandledRef.current) {
      return;
    }

    bootHandledRef.current = true;
    if (!bootRequest.autostart || !bootRequest.prompt) {
      return;
    }

    const payload = { prompt: bootRequest.prompt, currentBlueprint: undefined };
    if (bootRequest.autostart === "blueprint") {
      blueprintMutation.mutate(payload);
    } else {
      bundleMutation.mutate(payload);
    }

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [blueprintMutation, bootRequest, bundleMutation]);

  const handleGenerateBlueprint = () => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      toast({
        variant: "destructive",
        title: "Prompt required",
        description: "Describe the app before asking the engine to scaffold it.",
      });
      return;
    }

    blueprintMutation.mutate({
      prompt: normalizedPrompt,
      currentBlueprint: useCurrentBlueprint ? currentBlueprint : undefined,
    });
  };

  const handleGenerateBundle = () => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      toast({
        variant: "destructive",
        title: "Prompt required",
        description: "Describe the app before asking the engine to generate code.",
      });
      return;
    }

    bundleMutation.mutate({
      prompt: normalizedPrompt,
      currentBlueprint: useCurrentBlueprint ? currentBlueprint : undefined,
    });
  };

  const handleCopyExportPath = async () => {
    if (!materializedApp?.rootPath || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(materializedApp.rootPath);
    toast({
      title: "Path copied",
      description: materializedApp.rootPath,
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090909]" dir="ltr">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.14),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.11]" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl space-y-4">
            <Badge
              variant="outline"
              className="w-fit rounded-full border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100"
            >
              AI Engine Genesis
            </Badge>
            <div className="space-y-3">
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Prompt to DSL, DSL to code, code to a writable app scaffold.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-white/62 md:text-base">
                This studio keeps the blueprint alive between prompts, exposes the generated API
                contract, and lets you materialize the scaffold into the workspace when the bundle
                is ready.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={() => setLocation("/workspace")}>
              <Bot className="h-4 w-4" />
              Workspace
            </Button>
            <Button type="button" className="rounded-2xl px-5" onClick={() => setLocation("/ide")}>
              <Rocket className="h-4 w-4" />
              IDE
            </Button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
              <CardHeader className="space-y-3">
                <CardTitle className="flex items-center gap-3 text-white">
                  <Workflow className="h-5 w-5 text-cyan-200" />
                  Generation Control
                </CardTitle>
                <CardDescription className="text-white/58">
                  Build a planning pass first, then request a full scaffold when the shape feels right.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={PROMPT_PLACEHOLDER}
                  className="min-h-[220px] rounded-[1.5rem] border-white/10 bg-stone-950/70 text-sm leading-7 text-white placeholder:text-white/28"
                />

                <div className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-white">Use current blueprint as memory</div>
                    <div className="text-xs leading-6 text-white/45">
                      New prompts extend the existing application instead of starting from zero.
                    </div>
                  </div>
                  <Switch checked={useCurrentBlueprint} onCheckedChange={setUseCurrentBlueprint} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    disabled={currentMutationPending}
                    onClick={handleGenerateBlueprint}
                  >
                    {blueprintMutation.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Layers3 className="h-4 w-4" />
                    )}
                    Generate Blueprint
                  </Button>
                  <Button
                    type="button"
                    className="rounded-2xl"
                    disabled={currentMutationPending}
                    onClick={handleGenerateBundle}
                  >
                    {bundleMutation.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    Generate Bundle
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    disabled={!bundle || materializeMutation.isPending}
                    onClick={() => bundle && materializeMutation.mutate({ bundle })}
                  >
                    {materializeMutation.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <FolderOutput className="h-4 w-4" />
                    )}
                    Export Files
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-2xl border border-white/10"
                    onClick={() => {
                      setCurrentBlueprint(null);
                      setBundle(null);
                      setMaterializedApp(null);
                      setPrompt("");
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reset Session
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <GenerationMetric label="Entities" value={`${summary.entities}`} accent="text-cyan-200" />
              <GenerationMetric label="Endpoints" value={`${summary.endpoints}`} accent="text-amber-200" />
              <GenerationMetric label="Pages" value={`${summary.pages}`} accent="text-emerald-200" />
              <GenerationMetric label="Files" value={`${summary.files}`} accent="text-fuchsia-200" />
            </div>

            {currentMutationPending ? (
              <Card className="border-white/10 bg-white/[0.03]">
                <CardContent className="space-y-4 px-5 py-5">
                  <Skeleton className="h-5 w-32 bg-white/10" />
                  <Skeleton className="h-16 w-full bg-white/10" />
                  <Skeleton className="h-16 w-full bg-white/10" />
                </CardContent>
              </Card>
            ) : null}

            {effectiveBlueprint ? (
              <Alert className="border-cyan-300/18 bg-cyan-300/8 text-cyan-50">
                <Workflow className="h-4 w-4" />
                <AlertTitle>Active blueprint memory</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p className="leading-7 text-cyan-50/82">
                    {effectiveBlueprint.name} now holds {effectiveBlueprint.entities.length} entities,
                    {` ${effectiveBlueprint.endpoints.length}`} endpoints, and
                    {` ${effectiveBlueprint.pages.length}`} pages.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {effectiveBlueprint.entities.map((entity) => (
                      <Badge
                        key={entity.name}
                        variant="outline"
                        className="rounded-full border-cyan-200/20 bg-black/15 text-cyan-50"
                      >
                        {entity.name}
                      </Badge>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {materializedApp ? (
              <Alert className="border-emerald-300/18 bg-emerald-300/9 text-emerald-50">
                <FolderOutput className="h-4 w-4" />
                <AlertTitle>Scaffold written to disk</AlertTitle>
                <AlertDescription className="space-y-3">
                  <div className={CODE_PANEL_CLASS}>{materializedApp.rootPath}</div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={handleCopyExportPath}>
                      Copy Path
                    </Button>
                    <Button type="button" size="sm" className="rounded-xl" onClick={() => setLocation("/files")}>
                      Open Explorer
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
          </aside>

          <section className="space-y-5">
            {effectiveBlueprint || bundle ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-white/68">
                    {bundle?.metadata.usedModel ? "Model-assisted" : "Fallback heuristics"}
                  </Badge>
                  {bundle ? (
                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-white/68">
                      Generated {new Date(bundle.metadata.generatedAt).toLocaleString()}
                    </Badge>
                  ) : null}
                  {bundle ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-3 py-1",
                        bundle.diagnostics.length === 0
                          ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                          : "border-amber-300/20 bg-amber-300/10 text-amber-100",
                      )}
                    >
                      {bundle.diagnostics.length === 0
                        ? "Compile sanity pass clean"
                        : `${bundle.diagnostics.length} diagnostics to review`}
                    </Badge>
                  ) : null}
                </div>

                <Tabs defaultValue="dsl" className="space-y-4">
                  <TabsList className="h-auto flex-wrap rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-1">
                    <TabsTrigger value="dsl" className="rounded-xl px-4 py-2.5">
                      <Layers3 className="h-4 w-4" />
                      Blueprint DSL
                    </TabsTrigger>
                    <TabsTrigger value="files" className="rounded-xl px-4 py-2.5" disabled={!bundle}>
                      <FileCode2 className="h-4 w-4" />
                      Files
                    </TabsTrigger>
                    <TabsTrigger value="openapi" className="rounded-xl px-4 py-2.5" disabled={!bundle}>
                      <FileJson2 className="h-4 w-4" />
                      OpenAPI
                    </TabsTrigger>
                    <TabsTrigger value="ui" className="rounded-xl px-4 py-2.5" disabled={!bundle}>
                      <Bot className="h-4 w-4" />
                      UI Schema
                    </TabsTrigger>
                    <TabsTrigger value="diagnostics" className="rounded-xl px-4 py-2.5" disabled={!bundle}>
                      <Bug className="h-4 w-4" />
                      Diagnostics
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="dsl">
                    <JsonPanel value={effectiveBlueprint} />
                  </TabsContent>

                  <TabsContent value="files">
                    {bundle ? (
                      <FilesPanel
                        files={bundle.files}
                        selectedFilePath={selectedFilePath}
                        onSelect={setSelectedFilePath}
                      />
                    ) : null}
                  </TabsContent>

                  <TabsContent value="openapi">{bundle ? <JsonPanel value={bundle.openapi} /> : null}</TabsContent>

                  <TabsContent value="ui">
                    {bundle ? (
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <Card className="border-white/10 bg-white/[0.03]">
                          <CardHeader>
                            <CardTitle className="text-white">Generated UI preview</CardTitle>
                            <CardDescription className="text-white/55">
                              Rendered from the same schema returned by the generation pipeline.
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="min-h-[520px] rounded-[1.75rem] border border-white/10 bg-white p-4 text-stone-900">
                              <WidgetRenderer schema={bundle.uiSchema} />
                            </div>
                          </CardContent>
                        </Card>

                        <JsonPanel value={bundle.uiSchema} />
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="diagnostics">
                    <DiagnosticsPanel bundle={bundle} />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <EmptyResultState />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
