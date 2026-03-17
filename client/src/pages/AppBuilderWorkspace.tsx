import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, LoaderCircle, Plus } from "lucide-react";
import type { RouteComponentProps } from "wouter";
import { useLocation } from "wouter";
import Workspace from "@/components/AppBuilderWorkspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { normalizeUIComponent, type UIComponent } from "@shared/ui-schema";

interface WorkspaceRouteParams {
  [key: string]: string | undefined;
  id?: string;
}

interface ProjectDetailsResponse {
  id: string;
  name: string;
  createdAt: string;
  uiSchema: unknown;
}

function WorkspaceLoadingState() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-screen"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 0%, hsl(var(--foreground)/0.12) 1.5%, transparent 3.5%, transparent 100%), linear-gradient(to right, hsl(var(--foreground)/0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)/0.08) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 24px 24px, 24px 24px",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-10 h-[320px] w-[320px] rounded-full bg-accent/30 blur-[90px]" />
      <div className="pointer-events-none absolute -right-28 bottom-12 h-[360px] w-[360px] rounded-full bg-primary/28 blur-[95px]" />

      <Card className="relative z-10 w-full max-w-lg border-border/80 bg-card/72 backdrop-blur-xl">
        <CardContent className="flex flex-col items-center gap-4 px-8 py-12 text-center">
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-primary shadow-[0_18px_40px_-24px_hsl(var(--primary)/0.8)]">
            <LoaderCircle className="h-7 w-7 animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Loading saved workspace
            </h1>
            <p className="text-sm leading-7 text-foreground/58">
              The saved UI schema is being loaded into the live preview canvas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceErrorState({
  message,
  onStartNew,
}: {
  message: string;
  onStartNew: () => void;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-screen"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 0%, hsl(var(--foreground)/0.12) 1.5%, transparent 3.5%, transparent 100%), linear-gradient(to right, hsl(var(--foreground)/0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)/0.08) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 24px 24px, 24px 24px",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-10 h-[320px] w-[320px] rounded-full bg-accent/30 blur-[90px]" />
      <div className="pointer-events-none absolute -right-28 bottom-12 h-[360px] w-[360px] rounded-full bg-primary/28 blur-[95px]" />

      <Card className="relative z-10 w-full max-w-xl border-border/80 bg-card/72 backdrop-blur-xl">
        <CardContent className="space-y-6 px-8 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              The saved project could not be loaded
            </h1>
            <p className="text-sm leading-7 text-foreground/58">{message}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" size="lg" className="h-12 rounded-2xl px-6" onClick={onStartNew}>
              <Plus className="h-4 w-4" />
              Start New App
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getProjectLoadErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "The project archive is unavailable right now.";
  }

  if (error.message.startsWith("404:")) {
    return "Project not found.";
  }

  return "The saved project data could not be retrieved.";
}

export default function AppBuilderWorkspacePage({
  params,
}: RouteComponentProps<WorkspaceRouteParams>) {
  const [, setLocation] = useLocation();
  const routeProjectId =
    typeof params?.id === "string" && params.id.trim() ? params.id.trim() : undefined;

  const projectQuery = useQuery<ProjectDetailsResponse>({
    queryKey: ["/api/projects", routeProjectId],
    enabled: Boolean(routeProjectId),
  });

  const loadedSchema = useMemo<UIComponent | null>(() => {
    if (!projectQuery.data) {
      return null;
    }

    return normalizeUIComponent(projectQuery.data.uiSchema) ?? null;
  }, [projectQuery.data]);

  if (routeProjectId && projectQuery.isPending) {
    return <WorkspaceLoadingState />;
  }

  if (routeProjectId && projectQuery.isError) {
    return (
      <WorkspaceErrorState
        message={getProjectLoadErrorMessage(projectQuery.error)}
        onStartNew={() => setLocation("/workspace")}
      />
    );
  }

  return (
    <Workspace
      key={routeProjectId ?? "new"}
      routeProjectId={routeProjectId}
      initialProjectName={projectQuery.data?.name}
      initialUiSchema={loadedSchema}
    />
  );
}
