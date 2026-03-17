import {
  Fragment,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Code2,
  File,
  FileCode2,
  FileImage,
  FileJson2,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  TabletSmartphone,
  TerminalSquare,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type {
  FileExplorerDirectoryResponse,
  FileExplorerEntry,
  FileExplorerFileResponse,
  FileExplorerTreeNode,
} from "@shared/file-explorer";

type DraftStatus = "loading" | "saved" | "dirty" | "saving" | "error";
type PreviewViewport = "desktop" | "tablet" | "mobile";
type ConsoleLevel = "log" | "info" | "warn" | "error";

interface EditorDraft {
  content: string;
  savedContent: string;
  status: DraftStatus;
  language: string;
  isBinary: boolean;
  truncated: boolean;
  error: string | null;
  lastSavedAt: number | null;
}

interface OpenTab {
  path: string;
  name: string;
  extension: string | null;
}

interface ConsoleEntry {
  id: string;
  level: ConsoleLevel;
  message: string;
  timestamp: number;
}

interface AutosaveEvent {
  id: string;
  path: string;
  status: "saved" | "error";
  detail: string;
  timestamp: number;
}

const PREVIEW_BRIDGE_SCRIPT = `
(() => {
  const send = (payload) => window.parent.postMessage({
    source: 'nabd-ide-preview',
    ...payload,
  }, '*');

  const serialize = (value) => {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  ['log', 'info', 'warn', 'error'].forEach((level) => {
    const original = console[level];
    console[level] = (...args) => {
      send({
        type: 'console',
        level,
        message: args.map(serialize).join(' '),
      });
      original.apply(console, args);
    };
  });

  window.addEventListener('error', (event) => {
    send({
      type: 'console',
      level: 'error',
      message: event.error?.stack || event.message || 'Unknown preview error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    send({
      type: 'console',
      level: 'error',
      message: reason instanceof Error ? reason.stack || reason.message : serialize(reason),
    });
  });

  send({
    type: 'console',
    level: 'info',
    message: 'Preview bridge connected',
  });
})();
`;

function normalizePath(input: string | null | undefined): string {
  if (!input) {
    return "/";
  }

  return input;
}

function getParentPath(targetPath: string): string {
  if (targetPath === "/") {
    return "/";
  }

  const parts = targetPath.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "/";
  }

  return `/${parts.slice(0, -1).join("/")}`;
}

function getBaseName(targetPath: string): string {
  return targetPath.split("/").filter(Boolean).at(-1) ?? targetPath;
}

function getExtensionFromPath(targetPath: string): string | null {
  const name = getBaseName(targetPath);
  const extension = name.includes(".") ? name.split(".").at(-1)?.toLowerCase() ?? null : null;
  return extension || null;
}

function resolveExplorerPath(fromFilePath: string, relativePath: string, rootPath = "/"): string {
  if (relativePath.startsWith("/")) {
    const normalizedRoot = rootPath === "/" ? "" : rootPath;
    return `${normalizedRoot}${relativePath}`;
  }

  const baseSegments = getParentPath(fromFilePath).split("/").filter(Boolean);
  const nextSegments = relativePath.split("/").filter(Boolean);
  const output = [...baseSegments];

  for (const segment of nextSegments) {
    if (segment === ".") {
      continue;
    }

    if (segment === "..") {
      output.pop();
      continue;
    }

    output.push(segment);
  }

  return `/${output.join("/")}`;
}

function isLocalReference(reference: string): boolean {
  const trimmed = reference.trim();
  if (!trimmed) {
    return false;
  }

  return !/^(?:[a-z]+:)?\/\//i.test(trimmed) && !trimmed.startsWith("data:") && !trimmed.startsWith("#");
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function buildRawFileUrl(targetPath: string): string {
  return `/api/files/raw?path=${encodeURIComponent(targetPath)}`;
}

function escapeInlineScriptContent(value: string): string {
  return value.replace(/<\/script/gi, "<\\/script");
}

function getLanguageFromExtension(extension: string | null): string {
  switch (extension) {
    case "css":
      return "css";
    case "html":
      return "html";
    case "js":
    case "mjs":
      return "javascript";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "tsx":
    case "ts":
      return "typescript";
    case "svg":
    case "xml":
      return "xml";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "plaintext";
  }
}

function pickEntryIcon(entry: FileExplorerEntry) {
  if (entry.type === "directory") {
    return Folder;
  }

  if (entry.extension && ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(entry.extension)) {
    return FileImage;
  }

  if (entry.extension === "json") {
    return FileJson2;
  }

  if (entry.extension && ["ts", "tsx", "js", "jsx", "css", "html"].includes(entry.extension)) {
    return FileCode2;
  }

  if (entry.extension && ["md", "txt", "log", "env", "yml", "yaml"].includes(entry.extension)) {
    return FileText;
  }

  return File;
}

function formatRelativeTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: enUS,
  });
}

function countChangedLines(currentContent: string, savedContent: string): number {
  const currentLines = currentContent.split(/\r?\n/);
  const savedLines = savedContent.split(/\r?\n/);
  const maxLength = Math.max(currentLines.length, savedLines.length);
  let changedLines = 0;

  for (let index = 0; index < maxLength; index += 1) {
    if ((currentLines[index] ?? "") !== (savedLines[index] ?? "")) {
      changedLines += 1;
    }
  }

  return changedLines;
}

async function fetchDirectory(path: string): Promise<FileExplorerDirectoryResponse> {
  const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const message = (await response.text()) || "Failed to load the explorer.";
    throw new Error(`${response.status}: ${message}`);
  }

  return (await response.json()) as FileExplorerDirectoryResponse;
}

async function fetchFileContent(path: string): Promise<FileExplorerFileResponse> {
  const response = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const message = (await response.text()) || "Failed to load the file.";
    throw new Error(`${response.status}: ${message}`);
  }

  return (await response.json()) as FileExplorerFileResponse;
}

async function replaceAsync(
  input: string,
  pattern: RegExp,
  replacer: (match: RegExpMatchArray) => Promise<string>,
): Promise<string> {
  let lastIndex = 0;
  let output = "";

  for (const match of Array.from(input.matchAll(pattern))) {
    const index = match.index ?? 0;
    output += input.slice(lastIndex, index);
    output += await replacer(match);
    lastIndex = index + match[0].length;
  }

  output += input.slice(lastIndex);
  return output;
}

function rewriteCssAssetUrls(cssContent: string, cssPath: string, rootPath: string): string {
  return cssContent.replace(/url\(([^)]+)\)/gi, (fullMatch, rawReference: string) => {
    const reference = stripWrappingQuotes(rawReference);
    if (!isLocalReference(reference)) {
      return fullMatch;
    }

    const resolvedPath = resolveExplorerPath(cssPath, reference, rootPath);
    return `url("${buildRawFileUrl(resolvedPath)}")`;
  });
}

function rewriteMarkupAssetUrls(htmlContent: string, htmlPath: string, rootPath: string): string {
  return htmlContent.replace(
    /\b(src|poster)=["']([^"']+)["']/gi,
    (fullMatch, attribute: string, rawReference: string) => {
      if (!isLocalReference(rawReference)) {
        return fullMatch;
      }

      const resolvedPath = resolveExplorerPath(htmlPath, rawReference, rootPath);
      return `${attribute}="${buildRawFileUrl(resolvedPath)}"`;
    },
  );
}

async function buildPreviewDocument(
  htmlPath: string,
  getTextContent: (path: string) => Promise<string>,
): Promise<string> {
  const documentRootPath = getParentPath(htmlPath);
  let output = await getTextContent(htmlPath);

  output = await replaceAsync(
    output,
    /<link\b([^>]*?)rel=["']stylesheet["']([^>]*?)href=["']([^"']+)["']([^>]*)>/gi,
    async (match) => {
      const reference = match[3];
      if (!isLocalReference(reference)) {
        return match[0];
      }

      const stylesheetPath = resolveExplorerPath(htmlPath, reference, documentRootPath);
      const stylesheetContent = rewriteCssAssetUrls(
        await getTextContent(stylesheetPath),
        stylesheetPath,
        documentRootPath,
      );
      return `<style data-inline-path="${stylesheetPath}">\n${stylesheetContent}\n</style>`;
    },
  );

  output = await replaceAsync(
    output,
    /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    async (match) => {
      const attributesBefore = match[1] ?? "";
      const reference = match[2];
      const attributesAfter = match[3] ?? "";
      if (!isLocalReference(reference)) {
        return match[0];
      }

      const scriptPath = resolveExplorerPath(htmlPath, reference, documentRootPath);
      if (["ts", "tsx", "jsx"].includes(getExtensionFromPath(scriptPath) ?? "")) {
        throw new Error(
          `Preview currently supports HTML, CSS, and browser-ready JavaScript. "${getBaseName(scriptPath)}" requires a bundler/runtime step.`,
        );
      }
      const scriptContent = escapeInlineScriptContent(await getTextContent(scriptPath));
      return `<script${attributesBefore}${attributesAfter} data-inline-path="${scriptPath}">\n${scriptContent}\n</script>`;
    },
  );

  output = rewriteMarkupAssetUrls(output, htmlPath, documentRootPath);

  const bridgeScript = `<script>${escapeInlineScriptContent(PREVIEW_BRIDGE_SCRIPT)}</script>`;
  if (/<head[^>]*>/i.test(output)) {
    output = output.replace(/<head[^>]*>/i, (match) => `${match}\n${bridgeScript}`);
  } else {
    output = `${bridgeScript}\n${output}`;
  }

  return output;
}

function ExplorerTreeNode({
  node,
  currentPath,
  expandedPaths,
  onNavigate,
  onToggle,
}: {
  node: FileExplorerTreeNode;
  currentPath: string;
  expandedPaths: Set<string>;
  onNavigate: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isActive = currentPath === node.path;

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
          isActive
            ? "bg-primary/16 text-primary"
            : "text-foreground/72 hover:bg-secondary/45 hover:text-foreground",
        )}
        onClick={() => onNavigate(node.path)}
        onDoubleClick={() => onToggle(node.path)}
      >
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-foreground/45"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.path);
          }}
        >
          {node.children.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </span>
        {isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
        <span className="truncate">{node.name}</span>
      </button>

      {isExpanded && node.children.length > 0 ? (
        <div className="space-y-1 pl-4">
          {node.children.map((child) => (
            <ExplorerTreeNode
              key={child.path}
              node={child}
              currentPath={currentPath}
              expandedPaths={expandedPaths}
              onNavigate={onNavigate}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function IDE() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editorRef = useRef<Parameters<NonNullable<React.ComponentProps<typeof Editor>["onMount"]>>[0] | null>(null);

  const [currentPath, setCurrentPath] = useState("/");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(["/"]));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditorDraft>>({});
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
  const [previewDocument, setPreviewDocument] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [autosaveEvents, setAutosaveEvents] = useState<AutosaveEvent[]>([]);
  const [previewNonce, setPreviewNonce] = useState(0);

  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const directoryQuery = useQuery<FileExplorerDirectoryResponse>({
    queryKey: ["ide-directory", currentPath],
    queryFn: () => fetchDirectory(currentPath),
  });

  const previewDirectoryPath = activeFilePath ? getParentPath(activeFilePath) : currentPath;
  const previewDirectoryQuery = useQuery<FileExplorerDirectoryResponse>({
    queryKey: ["ide-preview-directory", previewDirectoryPath],
    queryFn: () => fetchDirectory(previewDirectoryPath),
  });

  useEffect(() => {
    const breadcrumbs = directoryQuery.data?.breadcrumbs ?? [];
    if (breadcrumbs.length === 0) {
      return;
    }

    setExpandedPaths((current) => {
      const next = new Set(current);
      for (const crumb of breadcrumbs) {
        next.add(crumb.path);
      }
      return next;
    });
  }, [directoryQuery.data?.breadcrumbs]);

  const visibleEntries = useMemo(() => {
    const entries = directoryQuery.data?.entries ?? [];
    if (!deferredSearchQuery) {
      return entries;
    }

    return entries.filter((entry) =>
      `${entry.name} ${entry.extension ?? ""}`.toLowerCase().includes(deferredSearchQuery),
    );
  }, [deferredSearchQuery, directoryQuery.data?.entries]);

  const directories = useMemo(
    () => visibleEntries.filter((entry) => entry.type === "directory"),
    [visibleEntries],
  );
  const files = useMemo(() => visibleEntries.filter((entry) => entry.type === "file"), [visibleEntries]);

  const activeDraft = activeFilePath ? drafts[activeFilePath] ?? null : null;
  const activeTab = activeFilePath ? openTabs.find((tab) => tab.path === activeFilePath) ?? null : null;

  const previewRootPath = useMemo(() => {
    const entries = previewDirectoryQuery.data?.entries ?? [];
    if (activeFilePath?.endsWith(".html")) {
      return activeFilePath;
    }

    const indexHtml = entries.find(
      (entry) => entry.type === "file" && entry.name.toLowerCase() === "index.html",
    );
    if (indexHtml) {
      return indexHtml.path;
    }

    const firstHtml = entries.find((entry) => entry.type === "file" && entry.extension === "html");
    return firstHtml?.path ?? null;
  }, [activeFilePath, previewDirectoryQuery.data?.entries]);

  const pushAutosaveEvent = useCallback(
    (event: Omit<AutosaveEvent, "id" | "timestamp">) => {
      setAutosaveEvents((current) => [
        {
          ...event,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now(),
        },
        ...current,
      ].slice(0, 12));
    },
    [],
  );

  const loadFile = useCallback(
    async (entry: FileExplorerEntry) => {
      if (entry.type !== "file") {
        return;
      }

      setOpenTabs((current) => {
        if (current.some((tab) => tab.path === entry.path)) {
          return current;
        }

        return [
          ...current,
          {
            path: entry.path,
            name: entry.name,
            extension: entry.extension,
          },
        ];
      });
      setActiveFilePath(entry.path);

      if (drafts[entry.path]) {
        return;
      }

      setDrafts((current) => ({
        ...current,
        [entry.path]: {
          content: "",
          savedContent: "",
          status: "loading",
          language: getLanguageFromExtension(entry.extension),
          isBinary: false,
          truncated: false,
          error: null,
          lastSavedAt: null,
        },
      }));

      try {
        const payload = await queryClient.ensureQueryData({
          queryKey: ["ide-file", entry.path],
          queryFn: () => fetchFileContent(entry.path),
        });

        setDrafts((current) => ({
          ...current,
          [entry.path]: {
            content: payload.content ?? "",
            savedContent: payload.content ?? "",
            status: "saved",
            language: getLanguageFromExtension(entry.extension),
            isBinary: !payload.isText,
            truncated: payload.truncated,
            error: payload.isText ? null : "Binary files are preview-only in the IDE.",
            lastSavedAt: Number.isNaN(new Date(payload.file.modifiedAt).getTime())
              ? null
              : new Date(payload.file.modifiedAt).getTime(),
          },
        }));
      } catch (error) {
        setDrafts((current) => ({
          ...current,
          [entry.path]: {
            content: "",
            savedContent: "",
            status: "error",
            language: getLanguageFromExtension(entry.extension),
            isBinary: false,
            truncated: false,
            error: error instanceof Error ? error.message : "Failed to open the file.",
            lastSavedAt: null,
          },
        }));
      }
    },
    [drafts, queryClient],
  );

  const saveMutation = useMutation({
    mutationFn: async (variables: { path: string; content: string }) => {
      const response = await apiRequest("PUT", "/api/files/content", variables);
      return {
        entry: (await response.json()) as FileExplorerEntry,
        ...variables,
      };
    },
    onSuccess: ({ entry, path, content }) => {
      setDrafts((current) => ({
        ...current,
        [path]: {
          ...(current[path] ?? {
            language: getLanguageFromExtension(entry.extension),
            isBinary: false,
            truncated: false,
            lastSavedAt: null,
          }),
          content,
          savedContent: content,
          status: "saved",
          error: null,
          lastSavedAt: Date.now(),
        },
      }));
      queryClient.setQueryData<FileExplorerFileResponse>(["ide-file", path], {
        file: entry,
        content,
        isText: true,
        truncated: false,
      });
      void queryClient.invalidateQueries({ queryKey: ["ide-directory"] });
      void queryClient.invalidateQueries({ queryKey: ["ide-preview-directory"] });
      pushAutosaveEvent({
        path,
        status: "saved",
        detail: `Saved ${getBaseName(path)}`,
      });
    },
    onError: (error, variables) => {
      setDrafts((current) => ({
        ...current,
        [variables.path]: {
          ...(current[variables.path] ?? {
            content: variables.content,
            savedContent: "",
            language: getLanguageFromExtension(getExtensionFromPath(variables.path)),
            isBinary: false,
            truncated: false,
            lastSavedAt: null,
          }),
          status: "error",
          error: error instanceof Error ? error.message : "Save failed.",
        },
      }));
      toast({
        variant: "destructive",
        title: "Autosave failed",
        description:
          error instanceof Error ? error.message : "The editor could not persist your changes.",
      });
      pushAutosaveEvent({
        path: variables.path,
        status: "error",
        detail: error instanceof Error ? error.message : `Save failed for ${getBaseName(variables.path)}`,
      });
    },
  });

  const persistDraft = useCallback(
    (path: string) => {
      const draft = drafts[path];
      if (!draft || draft.isBinary || draft.truncated || draft.status === "saving") {
        return;
      }

      if (draft.content === draft.savedContent) {
        return;
      }

      setDrafts((current) => ({
        ...current,
        [path]: {
          ...current[path],
          status: "saving",
          error: null,
        },
      }));

      void saveMutation.mutateAsync({
        path,
        content: draft.content,
      });
    },
    [drafts, saveMutation],
  );

  const flushDirtyDrafts = useCallback(
    (paths?: string[]) => {
      const nextPaths =
        paths ??
        Object.entries(drafts)
          .filter(([, draft]) => !draft.isBinary && !draft.truncated && draft.content !== draft.savedContent)
          .map(([path]) => path);

      for (const path of nextPaths) {
        persistDraft(path);
      }
    },
    [drafts, persistDraft],
  );

  const dirtyPaths = useMemo(
    () =>
      Object.entries(drafts)
        .filter(([, draft]) => !draft.isBinary && !draft.truncated && draft.content !== draft.savedContent)
        .map(([path]) => path),
    [drafts],
  );

  useEffect(() => {
    if (dirtyPaths.length === 0) {
      return;
    }

    const nextDirtyPath = dirtyPaths.find((path) => drafts[path]?.status !== "saving");
    if (!nextDirtyPath) {
      return;
    }

    const timer = window.setTimeout(() => {
      persistDraft(nextDirtyPath);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [drafts, dirtyPaths, persistDraft]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") {
        return;
      }

      if (!activeFilePath) {
        return;
      }

      event.preventDefault();
      persistDraft(activeFilePath);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFilePath, persistDraft]);

  useEffect(() => {
    const hasUnsavedDrafts = dirtyPaths.length > 0;
    if (!hasUnsavedDrafts) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyPaths.length]);

  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      flushDirtyDrafts();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        return;
      }

      flushDirtyDrafts();
    };

    window.addEventListener("blur", handleVisibilityOrBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", handleVisibilityOrBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushDirtyDrafts]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== "nabd-ide-preview") {
        return;
      }

      if (event.data.type !== "console") {
        return;
      }

      setConsoleEntries((current) => [
        ...current.slice(-149),
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          level: (event.data.level ?? "log") as ConsoleLevel,
          message: String(event.data.message ?? ""),
          timestamp: Date.now(),
        },
      ]);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!previewRootPath) {
      setPreviewDocument(null);
      setPreviewStatus("idle");
      setPreviewError(null);
      return;
    }

    setPreviewStatus("building");
    setPreviewError(null);

    const loadPreview = async () => {
      const getTextContent = async (path: string) => {
        const draft = drafts[path];
        if (draft && !draft.isBinary && !draft.truncated) {
          return draft.content;
        }

        const payload = await queryClient.ensureQueryData({
          queryKey: ["ide-preview-file", path],
          queryFn: () => fetchFileContent(path),
        });

        if (!payload.isText || payload.content === null) {
          throw new Error(`"${getBaseName(path)}" is not available for inline preview.`);
        }

        return payload.content;
      };

      const nextDocument = await buildPreviewDocument(previewRootPath, getTextContent);
      if (cancelled) {
        return;
      }

      setPreviewDocument(nextDocument);
      setPreviewStatus("ready");
      setPreviewError(null);
    };

    void loadPreview().catch((error) => {
      if (cancelled) {
        return;
      }

      setPreviewDocument(null);
      setPreviewStatus("error");
      setPreviewError(error instanceof Error ? error.message : "Preview build failed.");
    });

    return () => {
      cancelled = true;
    };
  }, [drafts, previewRootPath, previewNonce, queryClient]);

  const handleEditorBeforeMount = (monaco: Monaco) => {
    monaco.editor.defineTheme("nabd-ide", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6B7685" },
        { token: "keyword", foreground: "7DD3FC" },
        { token: "string", foreground: "FDBA74" },
        { token: "number", foreground: "FCA5A5" },
        { token: "type", foreground: "A7F3D0" },
      ],
      colors: {
        "editor.background": "#091019",
        "editor.lineHighlightBackground": "#111c2d",
        "editorLineNumber.foreground": "#506079",
        "editorLineNumber.activeForeground": "#C8D4E3",
        "editorIndentGuide.background1": "#182334",
        "editor.selectionBackground": "#16355d",
      },
    });

    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      target: monaco.languages.typescript.ScriptTarget.ES2020,
    });
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      target: monaco.languages.typescript.ScriptTarget.ES2020,
    });
  };

  const handleEditorMount: NonNullable<React.ComponentProps<typeof Editor>["onMount"]> = (editor) => {
    editorRef.current = editor;
  };

  const closeTab = (path: string) => {
    flushDirtyDrafts([path]);

    setOpenTabs((current) => {
      const next = current.filter((tab) => tab.path !== path);
      if (activeFilePath === path) {
        const nextActive = next.at(-1)?.path ?? null;
        setActiveFilePath(nextActive);
      }
      return next;
    });
  };

  const sidebarStatus = directoryQuery.isPending
    ? "Loading workspace"
    : `${(directoryQuery.data?.entries.length ?? 0).toString()} entries`;

  const activeAutosaveLabel = useMemo(() => {
    if (!activeDraft) {
      return "Autosave idle";
    }

    if (activeDraft.status === "saving") {
      return "Autosaving now";
    }

    if (activeDraft.status === "dirty") {
      return "Pending autosave";
    }

    if (activeDraft.status === "error") {
      return activeDraft.error ?? "Autosave error";
    }

    if (activeDraft.lastSavedAt) {
      return `Saved ${formatRelativeTimestamp(new Date(activeDraft.lastSavedAt).toISOString())}`;
    }

    return "Autosave ready";
  }, [activeDraft]);

  const activeChangedLines = useMemo(() => {
    if (!activeDraft) {
      return 0;
    }

    return countChangedLines(activeDraft.content, activeDraft.savedContent);
  }, [activeDraft]);

  return (
    <main
      dir="ltr"
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.1),transparent_24%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_20%),linear-gradient(180deg,#071018,#08111c)] px-4 py-5 text-left text-foreground md:px-6"
    >
      <div className="mx-auto flex max-w-[1920px] flex-col gap-5">
        <header className="rounded-[2rem] border border-border/75 bg-card/45 px-6 py-5 shadow-[0_40px_140px_-80px_rgba(0,0,0,1)] backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/75 bg-background/45 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-foreground/54">
                IDE Surface
              </div>
              <div className="space-y-2">
                <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-[3.15rem]">
                  Edit, preview, and inspect in one uninterrupted workspace.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-foreground/58 md:text-base">
                  Monaco powers the editor, autosave persists changes in the workspace,
                  and the preview pane rebuilds from your live draft state without a full reload.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 rounded-2xl border-border/75 bg-background/40 px-5"
                onClick={() => setLocation("/files")}
              >
                <ArrowLeft className="h-4 w-4" />
                Open File Explorer
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-11 rounded-2xl px-5"
                onClick={() => setPreviewNonce((current) => current + 1)}
              >
                <Play className="h-4 w-4" />
                Rebuild Preview
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-foreground/54">
            <div className="rounded-full border border-border/70 bg-background/35 px-4 py-2">
              {sidebarStatus}
            </div>
            <div className="rounded-full border border-border/70 bg-background/35 px-4 py-2">
              {dirtyPaths.length} dirty {dirtyPaths.length === 1 ? "file" : "files"}
            </div>
            <div className="rounded-full border border-border/70 bg-background/35 px-4 py-2">
              Preview: {previewRootPath ? getBaseName(previewRootPath) : "No HTML entry"}
            </div>
            <div className="rounded-full border border-border/70 bg-background/35 px-4 py-2">
              Autosave: {activeAutosaveLabel}
            </div>
            <div className="rounded-full border border-border/70 bg-background/35 px-4 py-2">
              Cmd/Ctrl+S to force save
            </div>
          </div>
        </header>

        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[calc(100vh-13rem)] rounded-[2rem] border border-border/75 bg-card/38 shadow-[0_30px_130px_-85px_rgba(0,0,0,1)] backdrop-blur-xl"
        >
          <ResizablePanel
            defaultSize={sidebarCollapsed ? 6 : 22}
            minSize={sidebarCollapsed ? 5 : 18}
            collapsible
            collapsedSize={5}
            onCollapse={() => setSidebarCollapsed(true)}
            onExpand={() => setSidebarCollapsed(false)}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-4">
                <div className={cn("space-y-1", sidebarCollapsed && "hidden")}>
                  <div className="text-xs uppercase tracking-[0.22em] text-foreground/42">
                    Navigator
                  </div>
                  <div className="text-sm font-semibold">Tree and folder files</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {!sidebarCollapsed ? (
                <>
                  <div className="space-y-3 border-b border-border/70 px-4 py-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/34" />
                      <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Filter current folder"
                        className="h-10 rounded-xl border-border/75 bg-background/40 pl-10"
                      />
                    </div>

                    <Breadcrumb>
                      <BreadcrumbList>
                        {(directoryQuery.data?.breadcrumbs ?? []).map((crumb, index, allCrumbs) => {
                          const isLast = index === allCrumbs.length - 1;
                          return (
                            <Fragment key={crumb.path}>
                              <BreadcrumbItem>
                                {isLast ? (
                                  <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                                ) : (
                                  <BreadcrumbLink
                                    href={crumb.path}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      setCurrentPath(crumb.path);
                                    }}
                                  >
                                    {crumb.name}
                                  </BreadcrumbLink>
                                )}
                              </BreadcrumbItem>
                              {!isLast ? <BreadcrumbSeparator /> : null}
                            </Fragment>
                          );
                        })}
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>

                  <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.55fr)_minmax(0,0.45fr)]">
                    <ScrollArea className="border-b border-border/70 px-3 py-4">
                      {directoryQuery.isPending && !directoryQuery.data ? (
                        <div className="flex h-40 items-center justify-center text-foreground/48">
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                        </div>
                      ) : directoryQuery.error instanceof Error ? (
                        <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/8 px-4 py-5 text-sm leading-7 text-destructive">
                          {directoryQuery.error.message}
                        </div>
                      ) : directoryQuery.data?.tree ? (
                        <ExplorerTreeNode
                          node={directoryQuery.data.tree}
                          currentPath={currentPath}
                          expandedPaths={expandedPaths}
                          onNavigate={(path) => setCurrentPath(path)}
                          onToggle={(path) =>
                            setExpandedPaths((current) => {
                              const next = new Set(current);
                              if (next.has(path)) {
                                next.delete(path);
                              } else {
                                next.add(path);
                              }
                              return next;
                            })
                          }
                        />
                      ) : null}
                    </ScrollArea>

                    <ScrollArea className="px-3 py-4">
                      <div className="mb-3 text-xs uppercase tracking-[0.22em] text-foreground/38">
                        Current folder
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.18em] text-foreground/32">
                            Directories
                          </div>
                          {directories.length > 0 ? (
                            directories.map((entry) => (
                              <button
                                key={entry.path}
                                type="button"
                                className="flex w-full items-center gap-3 rounded-xl border border-border/65 bg-background/25 px-3 py-2 text-left text-sm text-foreground/72 transition-colors hover:bg-secondary/40 hover:text-foreground"
                                onClick={() => setCurrentPath(entry.path)}
                              >
                                <Folder className="h-4 w-4 text-primary" />
                                <span className="truncate">{entry.name}</span>
                              </button>
                            ))
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/65 px-3 py-3 text-sm text-foreground/46">
                              No folders here
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.18em] text-foreground/32">
                            Files
                          </div>
                          {files.length > 0 ? (
                            files.map((entry) => {
                              const Icon = pickEntryIcon(entry);
                              const isOpen = openTabs.some((tab) => tab.path === entry.path);

                              return (
                                <button
                                  key={entry.path}
                                  type="button"
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                                    activeFilePath === entry.path
                                      ? "border-primary/35 bg-primary/10 text-primary"
                                      : "border-border/65 bg-background/25 text-foreground/72 hover:bg-secondary/40 hover:text-foreground",
                                  )}
                                  onClick={() => {
                                    if (activeFilePath && activeFilePath !== entry.path) {
                                      flushDirtyDrafts([activeFilePath]);
                                    }
                                    void loadFile(entry);
                                  }}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                                  {isOpen ? (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full border-primary/25 bg-primary/10 text-[10px] uppercase tracking-[0.16em] text-primary"
                                    >
                                      Open
                                    </Badge>
                                  ) : null}
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/65 px-3 py-3 text-sm text-foreground/46">
                              No files match this folder or filter
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <Code2 className="h-5 w-5 text-foreground/34" />
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={43} minSize={30}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-border/70 bg-background/35 p-2 text-primary">
                    <Code2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-foreground/38">
                      Editor
                    </div>
                    <div className="text-sm font-semibold">
                      {activeTab?.name ?? "Open a file"}
                    </div>
                    <div className="text-xs text-foreground/44">
                      {activeAutosaveLabel}
                      {activeChangedLines > 0 ? ` · ${activeChangedLines} changed lines` : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em]",
                      activeDraft?.status === "saving" && "border-sky-400/25 bg-sky-400/10 text-sky-200",
                      activeDraft?.status === "dirty" && "border-amber-400/25 bg-amber-400/10 text-amber-200",
                      activeDraft?.status === "saved" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
                      activeDraft?.status === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
                      !activeDraft && "border-border/70 bg-background/40 text-foreground/48",
                    )}
                  >
                    {activeDraft?.status ?? "idle"}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl px-3"
                    onClick={() => {
                      if (!activeFilePath) {
                        return;
                      }
                      persistDraft(activeFilePath);
                    }}
                    disabled={!activeFilePath || !activeDraft || activeDraft.status === "saving"}
                  >
                    {activeDraft?.status === "saving" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </div>

              <div className="border-b border-border/70 px-2 py-2">
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex items-center gap-2 pr-2">
                    {openTabs.length > 0 ? (
                      openTabs.map((tab) => {
                        const draft = drafts[tab.path];
                        const isDirty = draft ? draft.content !== draft.savedContent : false;
                        const changedLines = draft
                          ? countChangedLines(draft.content, draft.savedContent)
                          : 0;
                        const isActive = activeFilePath === tab.path;

                        return (
                          <button
                            key={tab.path}
                            type="button"
                            className={cn(
                              "group inline-flex h-10 items-center gap-3 rounded-xl border px-3 text-sm transition-colors",
                              isActive
                                ? "border-primary/35 bg-primary/10 text-primary"
                                : "border-border/70 bg-background/25 text-foreground/72 hover:bg-secondary/40 hover:text-foreground",
                            )}
                            onClick={() => {
                              if (activeFilePath && activeFilePath !== tab.path) {
                                flushDirtyDrafts([activeFilePath]);
                              }
                              setActiveFilePath(tab.path);
                            }}
                          >
                            <CircleDot
                              className={cn(
                                "h-3.5 w-3.5",
                                isDirty ? "text-amber-300" : "text-foreground/22",
                              )}
                            />
                            <span className="max-w-[180px] truncate">{tab.name}</span>
                            {changedLines > 0 ? (
                              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                                {changedLines}L
                              </span>
                            ) : null}
                            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-foreground/42">
                              {tab.extension ?? "file"}
                            </span>
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-foreground/45 transition-colors hover:bg-background/55 hover:text-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                closeTab(tab.path);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-foreground/42">
                        Open a file from the left sidebar to start editing.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="min-h-0 flex-1">
                {activeFilePath && activeDraft ? (
                  activeDraft.isBinary || activeDraft.truncated ? (
                    <div className="flex h-full items-center justify-center p-6">
                      <Card className="w-full max-w-xl border-border/75 bg-card/52">
                        <CardHeader>
                          <CardTitle>{activeTab?.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-7 text-foreground/58">
                          <p>
                            This file cannot be edited inline in the IDE. Large or binary assets stay
                            available in the preview/runtime flow, but the text editor only opens
                            text content.
                          </p>
                          {activeDraft.error ? (
                            <p className="text-destructive">{activeDraft.error}</p>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>
                  ) : activeDraft.status === "loading" ? (
                    <div className="flex h-full items-center justify-center text-foreground/48">
                      <LoaderCircle className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <Editor
                      key={activeFilePath}
                      beforeMount={handleEditorBeforeMount}
                      onMount={(editor, monaco) => {
                        handleEditorMount(editor, monaco);
                        editor.onDidBlurEditorText(() => {
                          flushDirtyDrafts([activeFilePath]);
                        });
                      }}
                      theme="nabd-ide"
                      language={activeDraft.language}
                      value={activeDraft.content}
                      onChange={(value) => {
                        setDrafts((current) => ({
                          ...current,
                          [activeFilePath]: {
                            ...current[activeFilePath],
                            content: value ?? "",
                            status:
                              (value ?? "") === current[activeFilePath].savedContent ? "saved" : "dirty",
                            error: null,
                          },
                        }));
                      }}
                      options={{
                        automaticLayout: true,
                        fontSize: 14,
                        fontLigatures: true,
                        formatOnPaste: true,
                        formatOnType: true,
                        minimap: {
                          enabled: true,
                        },
                        padding: {
                          top: 18,
                          bottom: 18,
                        },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        wordWrap: "on",
                      }}
                      loading={
                        <div className="flex h-full items-center justify-center text-foreground/48">
                          <LoaderCircle className="h-6 w-6 animate-spin" />
                        </div>
                      }
                    />
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
                    <div className="rounded-2xl border border-border/70 bg-background/35 p-4 text-primary">
                      <Code2 className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold">The editor is ready</h2>
                      <p className="max-w-md text-sm leading-7 text-foreground/54">
                        Pick a source file from the current folder list. Monaco will open it in a tab,
                        keep the draft live, and autosave changes back to the workspace.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={35} minSize={26}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={68} minSize={42}>
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl border border-border/70 bg-background/35 p-2 text-primary">
                        <Play className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-foreground/38">
                          Preview
                        </div>
                        <div className="text-sm font-semibold">
                          {previewRootPath ? getBaseName(previewRootPath) : "No HTML entrypoint"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={previewViewport === "desktop" ? "default" : "outline"}
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        onClick={() => setPreviewViewport("desktop")}
                      >
                        <Monitor className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant={previewViewport === "tablet" ? "default" : "outline"}
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        onClick={() => setPreviewViewport("tablet")}
                      >
                        <TabletSmartphone className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant={previewViewport === "mobile" ? "default" : "outline"}
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        onClick={() => setPreviewViewport("mobile")}
                      >
                        <Smartphone className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(12,18,27,0.95),rgba(7,12,20,0.98))] p-4">
                    {previewStatus === "building" ? (
                      <div className="flex h-full min-h-[280px] items-center justify-center text-foreground/48">
                        <LoaderCircle className="h-6 w-6 animate-spin" />
                      </div>
                    ) : previewError ? (
                      <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/8 px-4 py-5 text-sm leading-7 text-destructive">
                        {previewError}
                      </div>
                    ) : previewDocument ? (
                      <div className="flex min-h-full items-start justify-center">
                        <div
                          className={cn(
                            "overflow-hidden rounded-[1.7rem] border border-border/75 bg-white shadow-[0_35px_120px_-60px_rgba(0,0,0,0.95)] transition-[width] duration-300",
                            previewViewport === "desktop" && "w-full",
                            previewViewport === "tablet" && "w-full max-w-[860px]",
                            previewViewport === "mobile" && "w-full max-w-[420px]",
                          )}
                        >
                          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3 text-slate-500">
                            <span className="h-3 w-3 rounded-full bg-rose-400" />
                            <span className="h-3 w-3 rounded-full bg-amber-400" />
                            <span className="h-3 w-3 rounded-full bg-emerald-400" />
                            <span className="ml-3 truncate text-xs font-medium text-slate-600">
                              {previewRootPath}
                            </span>
                          </div>
                          <iframe
                            key={`${previewRootPath}-${previewNonce}`}
                            title="IDE preview"
                            srcDoc={previewDocument}
                            sandbox="allow-scripts allow-modals allow-forms"
                            className="h-[620px] w-full bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-dashed border-border/70 bg-background/22 px-6 text-center">
                        <Monitor className="h-9 w-9 text-foreground/28" />
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold">No preview target yet</h3>
                          <p className="max-w-sm text-sm leading-7 text-foreground/54">
                            Open an HTML file, or work in a folder that contains `index.html`,
                            and the preview pane will compile a live iframe from your draft state.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={32} minSize={20}>
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl border border-border/70 bg-background/35 p-2 text-primary">
                        <TerminalSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-foreground/38">
                          Console
                        </div>
                        <div className="text-sm font-semibold">
                          {consoleEntries.length} events captured
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl px-3"
                        onClick={() => setConsoleEntries([])}
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl px-3"
                        onClick={() => setPreviewNonce((current) => current + 1)}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Re-run
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 px-4 py-4">
                    <div className="space-y-3">
                      <div className="rounded-[1.4rem] border border-border/70 bg-background/24 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-foreground/36">
                              Autosave Activity
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {autosaveEvents.length > 0
                                ? `${autosaveEvents.length} recent events`
                                : "No autosave activity yet"}
                            </div>
                          </div>
                          {autosaveEvents.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 rounded-xl px-3 text-xs"
                              onClick={() => setAutosaveEvents([])}
                            >
                              Clear history
                            </Button>
                          ) : null}
                        </div>

                        {autosaveEvents.length > 0 ? (
                          <div className="space-y-2">
                            {autosaveEvents.map((event) => (
                              <div
                                key={event.id}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm",
                                  event.status === "saved"
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                    : "border-destructive/25 bg-destructive/10 text-destructive",
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{event.detail}</div>
                                  <div className="truncate text-xs opacity-75">{event.path}</div>
                                </div>
                                <div className="shrink-0 text-[11px] uppercase tracking-[0.16em] opacity-75">
                                  {formatRelativeTimestamp(new Date(event.timestamp).toISOString())}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-sm text-foreground/46">
                            As files autosave, the IDE records each success and failure here.
                          </div>
                        )}
                      </div>

                      {consoleEntries.length > 0 ? (
                        <>
                          <div className="pt-2 text-xs uppercase tracking-[0.18em] text-foreground/34">
                            Runtime Console
                          </div>
                          {consoleEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className={cn(
                                "rounded-2xl border px-4 py-3 text-sm leading-7",
                                entry.level === "error" &&
                                  "border-destructive/30 bg-destructive/10 text-destructive",
                                entry.level === "warn" &&
                                  "border-amber-400/25 bg-amber-400/10 text-amber-100",
                                (entry.level === "log" || entry.level === "info") &&
                                  "border-border/70 bg-background/35 text-foreground/72",
                              )}
                            >
                              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em]">
                                <span>{entry.level}</span>
                                <span className="text-foreground/38">
                                  {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6">
                                {entry.message}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-border/70 bg-background/20 px-6 text-center">
                          <TerminalSquare className="h-8 w-8 text-foreground/28" />
                          <div className="space-y-2">
                            <h3 className="text-base font-semibold">Console is listening</h3>
                            <p className="max-w-sm text-sm leading-7 text-foreground/52">
                              Logs, warnings, and runtime errors from the preview iframe appear
                              here as soon as the page executes.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </main>
  );
}
