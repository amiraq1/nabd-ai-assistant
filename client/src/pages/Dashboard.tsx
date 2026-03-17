import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Code2,
  LibraryBig,
  LoaderCircle,
  Plus,
  Rocket,
  Smartphone,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { STUDIO_PROMPT_SCENES, type StudioPromptScene } from "@/lib/studio-scenes";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { LibraryCatalogStats } from "@shared/library-catalog";

interface ProjectSummary {
  id: string;
  name: string;
  platform?: string;
  createdAt: string;
}

interface StudioModule {
  title: string;
  eyebrow: string;
  description: string;
  actionLabel: string;
  statLabel: string;
  statValue: string;
  href: string;
  icon: LucideIcon;
  tone: string;
}

const CARD_THEMES = [
  {
    panel:
      "border-amber-300/12 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_42%),linear-gradient(160deg,rgba(25,18,8,0.96),rgba(12,12,12,0.92))]",
    glow: "bg-amber-400/28",
    chip: "border-amber-300/14 bg-amber-300/10 text-amber-100/90",
  },
  {
    panel:
      "border-cyan-300/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_42%),linear-gradient(160deg,rgba(6,18,24,0.96),rgba(12,12,12,0.92))]",
    glow: "bg-cyan-400/25",
    chip: "border-cyan-300/14 bg-cyan-300/10 text-cyan-100/90",
  },
  {
    panel:
      "border-emerald-300/12 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.22),transparent_42%),linear-gradient(160deg,rgba(7,21,18,0.96),rgba(12,12,12,0.92))]",
    glow: "bg-emerald-400/25",
    chip: "border-emerald-300/14 bg-emerald-300/10 text-emerald-100/90",
  },
];

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { absolute: "Unknown date", relative: "Unavailable" };
  }

  return {
    absolute: format(date, "MMMM d, yyyy", { locale: enUS }),
    relative: formatDistanceToNowStrict(date, { addSuffix: true, locale: enUS }),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function MetricTile({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-xs leading-6 text-white/48">{description}</div>
    </div>
  );
}

function DashboardHeader({
  projectCount,
  libraryStats,
  onCreate,
  onOpenEngine,
  onOpenLibrary,
}: {
  projectCount: number;
  libraryStats: LibraryCatalogStats | null;
  onCreate: () => void;
  onOpenEngine: () => void;
  onOpenLibrary: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(150deg,rgba(15,15,15,0.96),rgba(8,8,8,0.92))] p-6 shadow-[0_42px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl md:p-8 xl:p-10">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_420px] xl:items-end">
        <div className="relative space-y-6">
          <div className="pointer-events-none absolute -left-10 top-4 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-28 h-40 w-40 rounded-full bg-amber-400/12 blur-3xl" />

          <Badge
            variant="outline"
            className="w-fit rounded-full border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/72"
          >
            Command Deck
          </Badge>

          <div className="space-y-4">
            <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl xl:text-6xl">
              One control room for concepts, scaffolds, archives, and code.
            </h1>
            <p className="max-w-3xl text-sm leading-8 text-white/58 md:text-base">
              Launch a fresh canvas, orchestrate a full-stack scaffold with the AI engine, step
              into the IDE, or audit the archive from one cinematic surface.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" className="rounded-2xl px-5" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              New live canvas
            </Button>
            <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={onOpenEngine}>
              <Rocket className="h-4 w-4" />
              Prototype with AI
            </Button>
            <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={onOpenLibrary}>
              <LibraryBig className="h-4 w-4" />
              Open archive
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <MetricTile
            label="Saved builds"
            value={String(projectCount)}
            description="Projects ready for refinement, handoff, or re-entry into the builder."
          />
          <MetricTile
            label="Catalog assets"
            value={String(libraryStats?.totalItems ?? 0)}
            description="Records already disciplined into the archive and search taxonomy."
          />
          <MetricTile
            label="Digital holdings"
            value={String(libraryStats?.digitalAssets ?? 0)}
            description="Born-digital items available for retrieval, inspection, and controlled circulation."
          />
        </div>
      </div>
    </div>
  );
}

function StudioModuleCard({
  module,
  index,
  onOpen,
}: {
  module: StudioModule;
  index: number;
  onOpen: (href: string) => void;
}) {
  const Icon = module.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(module.href)}
      className={cn(
        "group relative overflow-hidden rounded-[1.9rem] border p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_80px_-38px_rgba(0,0,0,0.95)]",
        module.tone,
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_30%,transparent_72%,rgba(255,255,255,0.04))]" />
      <div className="relative flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">{module.eyebrow}</div>
            <div className="text-xl font-semibold tracking-tight text-white">{module.title}</div>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/10 p-3 text-white/80">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="max-w-sm text-sm leading-7 text-white/62">{module.description}</p>
        <div className="mt-auto flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/36">{module.statLabel}</div>
            <div className="mt-2 text-lg font-medium text-white">{module.statValue}</div>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-white/78 transition-transform duration-300 group-hover:translate-x-1">
            {module.actionLabel}
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </button>
  );
}

function PromptSceneCard({
  scene,
  onLaunch,
}: {
  scene: StudioPromptScene;
  onLaunch: (prompt: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onLaunch(scene.prompt)}
      className={cn(
        "group relative overflow-hidden rounded-[1.8rem] border p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-38px_rgba(0,0,0,0.95)]",
        scene.palette,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_34%,transparent_70%,rgba(255,255,255,0.04))]" />
      <div className="relative flex h-full flex-col gap-4">
        <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/68">
          {scene.label}
        </div>
        <div className="text-2xl font-semibold tracking-tight text-white">{scene.title}</div>
        <p className="max-w-xl text-sm leading-7 text-white/62">{scene.description}</p>
        <div className="mt-auto flex items-center gap-2 text-sm font-medium text-white/82 transition-transform duration-300 group-hover:translate-x-1">
          Launch in AI Engine
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}

function ProjectIllustration({ accentClass }: { accentClass: string }) {
  return (
    <div className="relative h-36 overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/20">
      <div className={cn("absolute left-4 top-4 h-16 w-16 rounded-full blur-2xl", accentClass)} />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_28%,transparent_72%,rgba(255,255,255,0.05))]" />
      <div className="absolute inset-x-0 top-7 mx-auto h-px w-[76%] bg-white/10" />
      <div className="absolute inset-x-0 top-14 mx-auto h-px w-[64%] bg-white/8" />
      <div className="absolute inset-x-0 top-24 mx-auto h-px w-[82%] bg-white/10" />
      <div className="absolute left-5 top-9 h-12 w-24 rounded-[1.25rem] border border-white/10 bg-white/8" />
      <div className="absolute right-6 top-10 h-16 w-16 rounded-[1.5rem] border border-white/10 bg-white/8" />
      <div className="absolute bottom-5 left-5 flex gap-3">
        <div className="h-7 w-24 rounded-full border border-white/10 bg-white/8" />
        <div className="h-7 w-14 rounded-full border border-white/10 bg-white/8" />
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  index,
  onOpen,
  onDelete,
}: {
  project: ProjectSummary;
  index: number;
  onOpen: (id: string) => void;
  onDelete: (project: ProjectSummary) => void;
}) {
  const formattedDate = formatCreatedAt(project.createdAt);
  const theme = CARD_THEMES[index % CARD_THEMES.length];

  const handleOpen = () => onOpen(project.id);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
      className={cn(
        "group relative overflow-hidden rounded-[2rem] border p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_100px_-46px_rgba(0,0,0,0.98)] focus:outline-none focus:ring-2 focus:ring-cyan-300/50",
        theme.panel,
      )}
    >
      <div className="relative flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]", theme.chip)}>
              Saved build
            </Badge>
            <h3 className="text-2xl font-semibold tracking-tight text-white">{project.name}</h3>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full border border-white/10 bg-black/20 text-white/58 hover:bg-white/10 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(project);
            }}
            aria-label={`Delete ${project.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <ProjectIllustration accentClass={theme.glow} />

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/36">
              <CalendarDays className="h-4 w-4" />
              Created
            </div>
            <div className="mt-3 text-base font-medium text-white">{formattedDate.absolute}</div>
            <div className="mt-1 text-sm text-white/48">{formattedDate.relative}</div>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-white/80 transition-transform duration-300 group-hover:translate-x-1">
            Open workspace
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </article>
  );
}

function ProjectGridSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="overflow-hidden rounded-[2rem] border-white/10 bg-white/[0.03]">
          <CardHeader className="space-y-4">
            <Skeleton className="h-6 w-28 bg-white/10" />
            <Skeleton className="h-10 w-2/3 bg-white/10" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-36 w-full rounded-[1.5rem] bg-white/10" />
            <Skeleton className="h-5 w-40 bg-white/10" />
            <Skeleton className="h-4 w-24 bg-white/10" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({
  onCreate,
  onEngine,
}: {
  onCreate: () => void;
  onEngine: () => void;
}) {
  return (
    <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <CardContent className="relative flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.12),transparent_34%)]" />
        <div className="relative z-10 max-w-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-cyan-300/18 bg-cyan-300/10 text-cyan-100">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="text-3xl font-semibold tracking-tight text-white">
            You haven&apos;t created any apps yet.
          </h3>
          <p className="mt-4 text-sm leading-7 text-white/58">
            Start from a live canvas if you already know the shape, or let the AI engine draft the
            system first and materialize the scaffold when the vibe lands.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button type="button" className="rounded-2xl px-5" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              Create your first app
            </Button>
            <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={onEngine}>
              <Rocket className="h-4 w-4" />
              Open AI Engine
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="rounded-[2rem] border-rose-400/25 bg-rose-400/10 backdrop-blur-xl">
      <CardContent className="space-y-5 px-6 py-8">
        <div className="inline-flex rounded-full border border-rose-300/20 bg-black/15 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-rose-100">
          Archive unavailable
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold tracking-tight text-white">
            The project archive could not be loaded.
          </h3>
          <p className="max-w-2xl text-sm leading-7 text-rose-50/72">{message}</p>
        </div>
        <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={onRetry}>
          Retry archive query
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(null);

  const projectsQuery = useQuery<ProjectSummary[]>({
    queryKey: ["/api/projects"],
  });

  const libraryStatsQuery = useQuery<LibraryCatalogStats>({
    queryKey: ["/api/library/stats"],
  });

  const projects = projectsQuery.data ?? [];
  const libraryStats = libraryStatsQuery.data ?? null;

  const studioModules = useMemo<StudioModule[]>(
    () => [
      {
        title: "Workspace",
        eyebrow: "Live Builder",
        description:
          "Shape responsive canvases directly, iterate visually, and save the exact UI state you want to reopen later.",
        actionLabel: "Open canvas",
        statLabel: "Saved builds",
        statValue: `${projects.length}`,
        href: "/workspace",
        icon: Smartphone,
        tone:
          "border-cyan-300/14 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_40%),linear-gradient(160deg,rgba(8,20,24,0.96),rgba(12,12,12,0.92))]",
      },
      {
        title: "AI Engine",
        eyebrow: "Scaffold System",
        description:
          "Move from natural-language intent to blueprint, OpenAPI, generated files, and deployable structure in one pass.",
        actionLabel: "Launch engine",
        statLabel: "Prompt mode",
        statValue: "Blueprint + code",
        href: "/engine",
        icon: Rocket,
        tone:
          "border-amber-300/14 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_40%),linear-gradient(160deg,rgba(25,17,8,0.96),rgba(12,12,12,0.92))]",
      },
      {
        title: "Archive Catalog",
        eyebrow: "Library Discipline",
        description:
          "Control metadata-rich holdings, circulation, and findability from a system designed for precision and long memory.",
        actionLabel: "Open archive",
        statLabel: "Catalog items",
        statValue: `${libraryStats?.totalItems ?? 0}`,
        href: "/library",
        icon: LibraryBig,
        tone:
          "border-emerald-300/14 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.22),transparent_40%),linear-gradient(160deg,rgba(8,22,18,0.96),rgba(12,12,12,0.92))]",
      },
      {
        title: "Web IDE",
        eyebrow: "Code Surface",
        description:
          "Inspect generated files, edit with Monaco, autosave continuously, and watch the preview react without leaving the cockpit.",
        actionLabel: "Open IDE",
        statLabel: "Editing mode",
        statValue: "Autosave + preview",
        href: "/ide",
        icon: Code2,
        tone:
          "border-fuchsia-300/14 bg-[radial-gradient(circle_at_top_left,rgba(232,121,249,0.2),transparent_40%),linear-gradient(160deg,rgba(22,9,24,0.96),rgba(12,12,12,0.92))]",
      },
    ],
    [libraryStats?.totalItems, projects.length],
  );

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.setQueryData<ProjectSummary[]>(["/api/projects"], (current) =>
        (current ?? []).filter((project) => project.id !== projectId),
      );
      void queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setProjectToDelete(null);
      toast({
        title: "Project deleted",
        description: "The build was removed from your archive.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: getErrorMessage(error, "The project could not be deleted."),
      });
    },
  });

  const reveal = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.58,
            delay,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        };

  const handleCreate = () => setLocation("/workspace");
  const handleOpenEngine = () => setLocation("/engine");
  const handleOpenLibrary = () => setLocation("/library");
  const handleOpenProject = (id: string) => setLocation(`/workspace/${id}`);
  const handleOpenModule = (href: string) => setLocation(href);
  const handleLaunchPromptScene = (prompt: string) =>
    setLocation(`/engine?prompt=${encodeURIComponent(prompt)}&autostart=bundle`);

  const projectSectionBody = (() => {
    if (projectsQuery.isLoading) {
      return <ProjectGridSkeleton />;
    }

    if (projectsQuery.isError) {
      return (
        <ErrorState
          message={getErrorMessage(projectsQuery.error, "The project archive is currently unavailable.")}
          onRetry={() => void queryClient.invalidateQueries({ queryKey: ["/api/projects"] })}
        />
      );
    }

    if (projects.length === 0) {
      return <EmptyState onCreate={handleCreate} onEngine={handleOpenEngine} />;
    }

    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            index={index}
            onOpen={handleOpenProject}
            onDelete={setProjectToDelete}
          />
        ))}
      </div>
    );
  })();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080808]" dir="ltr">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_26%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.12),transparent_28%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-[1560px] flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
        <motion.section {...reveal(0)}>
          <DashboardHeader
            projectCount={projects.length}
            libraryStats={libraryStats}
            onCreate={handleCreate}
            onOpenEngine={handleOpenEngine}
            onOpenLibrary={handleOpenLibrary}
          />
        </motion.section>

        <motion.section {...reveal(0.06)} className="grid gap-6 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
          <Card className="overflow-hidden rounded-[2.15rem] border-white/10 bg-white/[0.03] backdrop-blur-2xl">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl font-semibold tracking-tight text-white">
                    Prompt scenes
                  </CardTitle>
                  <CardDescription className="mt-2 max-w-lg text-sm leading-7 text-white/55">
                    Skip the blank page. Launch the engine with a fully primed scene and let the
                    scaffold arrive already carrying atmosphere.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/66"
                >
                  Quick ignition
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {STUDIO_PROMPT_SCENES.map((scene) => (
                <PromptSceneCard key={scene.title} scene={scene} onLaunch={handleLaunchPromptScene} />
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            {studioModules.map((module, index) => (
              <StudioModuleCard key={module.href} module={module} index={index} onOpen={handleOpenModule} />
            ))}
          </div>
        </motion.section>

        <motion.section {...reveal(0.12)} className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/42">
                <BookOpen className="h-4 w-4" />
                Project Archive
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Recent builds
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/55">
                Re-open any saved surface, keep iterating with the current schema in context, or
                clear experiments that no longer belong in the archive.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {libraryStatsQuery.isFetching ? (
                <Badge
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-white/62"
                >
                  <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Syncing metrics
                </Badge>
              ) : null}
              <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={handleOpenLibrary}>
                <LibraryBig className="h-4 w-4" />
                Library
              </Button>
              <Button type="button" className="rounded-2xl px-5" onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                Create New App
              </Button>
            </div>
          </div>

          {projectSectionBody}
        </motion.section>
      </main>

      <AlertDialog open={Boolean(projectToDelete)} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent className="rounded-[1.75rem] border-white/10 bg-[#111111] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold tracking-tight">
              Delete this build?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-7 text-white/58">
              {projectToDelete
                ? `${projectToDelete.name} will be removed from the archive together with its saved UI schema. This cannot be undone.`
                : "This project will be removed from the archive."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-white/10 bg-transparent text-white hover:bg-white/10">
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-rose-500 text-white hover:bg-rose-600"
              disabled={!projectToDelete || deleteProjectMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!projectToDelete) {
                  return;
                }
                deleteProjectMutation.mutate(projectToDelete.id);
              }}
            >
              {deleteProjectMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
