import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Grid2x2,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type {
  FileExplorerDirectoryResponse,
  FileExplorerEntry,
  FileExplorerFileResponse,
  FileExplorerTreeNode,
  FileSystemEntryType,
} from "@shared/file-explorer";

type ExplorerViewMode = "list" | "grid";

function normalizePath(input: string | null | undefined): string {
  if (!input || input === "") {
    return "/";
  }

  return input;
}

function joinExplorerPath(parentPath: string, name: string): string {
  if (parentPath === "/") {
    return `/${name}`;
  }

  return `${parentPath}/${name}`;
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
  return targetPath.split("/").filter(Boolean).at(-1) ?? "";
}

function replacePathPrefix(
  currentPath: string | null,
  previousPath: string,
  nextPath: string,
): string | null {
  if (!currentPath) {
    return currentPath;
  }

  if (currentPath === previousPath) {
    return nextPath;
  }

  if (currentPath.startsWith(`${previousPath}/`)) {
    return `${nextPath}${currentPath.slice(previousPath.length)}`;
  }

  return currentPath;
}

function formatEntrySize(size: number): string {
  if (size === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return `${format(date, "MMM d, yyyy", { locale: enUS })} · ${formatDistanceToNowStrict(
    date,
    {
      addSuffix: true,
      locale: enUS,
    },
  )}`;
}

function pickEntryIcon(entry: FileExplorerEntry) {
  if (entry.type === "directory") {
    return Folder;
  }

  if (entry.extension && ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(entry.extension)) {
    return FileImage;
  }

  if (entry.extension && ["ts", "tsx", "js", "jsx", "json", "css", "html", "md"].includes(entry.extension)) {
    return FileCode2;
  }

  if (entry.extension && ["csv", "xlsx"].includes(entry.extension)) {
    return FileSpreadsheet;
  }

  if (entry.extension && ["txt", "log", "env", "yml", "yaml"].includes(entry.extension)) {
    return FileText;
  }

  return File;
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

function ExplorerTreeNode({
  node,
  currentPath,
  expandedPaths,
  dropTargetPath,
  onNavigate,
  onToggle,
  onDropEntry,
  onDragTargetChange,
}: {
  node: FileExplorerTreeNode;
  currentPath: string;
  expandedPaths: Set<string>;
  dropTargetPath: string | null;
  onNavigate: (path: string) => void;
  onToggle: (path: string) => void;
  onDropEntry: (targetDirectoryPath: string) => void;
  onDragTargetChange: (targetPath: string | null) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isActive = currentPath === node.path;
  const isDropTarget = dropTargetPath === node.path;

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
          isActive
            ? "bg-primary/14 text-primary"
            : "text-foreground/72 hover:bg-secondary/45 hover:text-foreground",
          isDropTarget && "ring-2 ring-primary/35 ring-offset-1 ring-offset-background",
        )}
        onClick={() => onNavigate(node.path)}
        onDoubleClick={() => onToggle(node.path)}
        onDragOver={(event) => {
          event.preventDefault();
          onDragTargetChange(node.path);
        }}
        onDragLeave={() => onDragTargetChange(null)}
        onDrop={(event) => {
          event.preventDefault();
          onDragTargetChange(null);
          onDropEntry(node.path);
        }}
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
              dropTargetPath={dropTargetPath}
              onNavigate={onNavigate}
              onToggle={onToggle}
              onDropEntry={onDropEntry}
              onDragTargetChange={onDragTargetChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyDirectoryState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border/70 bg-card/30 px-6 text-center">
      <FolderOpen className="h-10 w-10 text-foreground/28" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        {searchQuery ? "No matching entries" : "This folder is empty"}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-7 text-foreground/55">
        {searchQuery
          ? "Try a different search term or clear the filter."
          : "Create a new file or folder to start organizing the workspace."}
      </p>
    </div>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        '[data-explorer-actions="true"],button,input,textarea,[role="menuitem"]',
      ),
    )
  );
}

export default function FileExplorer() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentPath, setCurrentPath] = useState("/");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ExplorerViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(["/"]));
  const [createKind, setCreateKind] = useState<FileSystemEntryType | null>(null);
  const [createName, setCreateName] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FileExplorerEntry | null>(null);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState("");

  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const directoryQuery = useQuery<FileExplorerDirectoryResponse>({
    queryKey: ["file-explorer", currentPath],
    queryFn: () => fetchDirectory(currentPath),
  });

  const selectedEntry = useMemo(
    () => directoryQuery.data?.entries.find((entry) => entry.path === selectedPath) ?? null,
    [directoryQuery.data?.entries, selectedPath],
  );

  const fileQuery = useQuery<FileExplorerFileResponse>({
    queryKey: ["file-explorer-content", selectedPath],
    queryFn: () => fetchFileContent(selectedPath ?? "/"),
    enabled: Boolean(selectedPath && selectedEntry?.type === "file"),
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

  useEffect(() => {
    if (!fileQuery.data) {
      return;
    }

    setEditorDraft(fileQuery.data.content ?? "");
  }, [fileQuery.data]);

  useEffect(() => {
    setSelectedPath((current) => {
      if (!current) {
        return null;
      }

      return getParentPath(current) === currentPath ? current : null;
    });
  }, [currentPath]);

  const filteredEntries = useMemo(() => {
    const entries = directoryQuery.data?.entries ?? [];
    if (!deferredSearchQuery) {
      return entries;
    }

    return entries.filter((entry) =>
      `${entry.name} ${entry.extension ?? ""}`.toLowerCase().includes(deferredSearchQuery),
    );
  }, [deferredSearchQuery, directoryQuery.data?.entries]);

  const refreshExplorer = () => {
    void queryClient.invalidateQueries({ queryKey: ["file-explorer"] });
  };

  const createMutation = useMutation({
    mutationFn: async (variables: { type: FileSystemEntryType; name: string }) => {
      const response = await apiRequest("POST", "/api/files", {
        parentPath: currentPath,
        type: variables.type,
        name: variables.name,
        content: variables.type === "file" ? "" : undefined,
      });

      return (await response.json()) as FileExplorerEntry;
    },
    onSuccess: (entry) => {
      setCreateKind(null);
      setCreateName("");
      setSelectedPath(entry.type === "file" ? entry.path : null);
      if (entry.type === "directory") {
        setExpandedPaths((current) => new Set(current).add(currentPath));
      }
      refreshExplorer();
      toast({
        title: entry.type === "directory" ? "Folder created" : "File created",
        description: `"${entry.name}" is ready.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Create failed",
        description:
          error instanceof Error ? error.message : "The entry could not be created.",
      });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (variables: { fromPath: string; toPath: string }) => {
      const response = await apiRequest("PATCH", "/api/files", variables);
      return {
        entry: (await response.json()) as FileExplorerEntry,
        ...variables,
      };
    },
    onSuccess: ({ entry, fromPath, toPath }) => {
      setCurrentPath((current) => normalizePath(replacePathPrefix(current, fromPath, toPath)));
      setSelectedPath((current) => replacePathPrefix(current, fromPath, toPath));
      setRenamingPath(null);
      setRenameDraft("");
      setDropTargetPath(null);
      setDraggedPath(null);
      refreshExplorer();
      toast({
        title: "Entry moved",
        description: `"${entry.name}" was updated successfully.`,
      });
    },
    onError: (error) => {
      setDropTargetPath(null);
      setDraggedPath(null);
      toast({
        variant: "destructive",
        title: "Move failed",
        description:
          error instanceof Error ? error.message : "The entry could not be moved.",
      });
    },
  });

  const saveContentMutation = useMutation({
    mutationFn: async (variables: { path: string; content: string }) => {
      const response = await apiRequest("PUT", "/api/files/content", variables);
      return (await response.json()) as FileExplorerEntry;
    },
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({
        queryKey: ["file-explorer-content", entry.path],
      });
      refreshExplorer();
      toast({
        title: "File saved",
        description: `"${entry.name}" was written to disk.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Save failed",
        description:
          error instanceof Error ? error.message : "The file could not be saved.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entry: FileExplorerEntry) => {
      await apiRequest("DELETE", "/api/files", {
        path: entry.path,
      });
      return entry;
    },
    onSuccess: (entry) => {
      setDeleteTarget(null);
      setSelectedPath((current) =>
        current && (current === entry.path || current.startsWith(`${entry.path}/`)) ? null : current,
      );
      setCurrentPath((current) =>
        current === entry.path || current.startsWith(`${entry.path}/`)
          ? getParentPath(entry.path)
          : current,
      );
      refreshExplorer();
      toast({
        title: "Entry deleted",
        description: `"${entry.name}" was removed.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description:
          error instanceof Error ? error.message : "The entry could not be removed.",
      });
    },
  });

  const directoryMeta = directoryQuery.data;
  const hasUnsavedEditorChanges =
    Boolean(fileQuery.data?.isText) && (fileQuery.data?.content ?? "") !== editorDraft;

  const submitRename = (entry: FileExplorerEntry) => {
    const nextName = renameDraft.trim();
    if (!nextName || nextName === entry.name) {
      setRenamingPath(null);
      setRenameDraft("");
      return;
    }

    void moveMutation.mutateAsync({
      fromPath: entry.path,
      toPath: joinExplorerPath(getParentPath(entry.path), nextName),
    });
  };

  const dropEntryIntoDirectory = (targetDirectoryPath: string) => {
    if (!draggedPath) {
      return;
    }

    const nextPath = joinExplorerPath(targetDirectoryPath, getBaseName(draggedPath));
    if (nextPath === draggedPath) {
      setDraggedPath(null);
      setDropTargetPath(null);
      return;
    }

    void moveMutation.mutateAsync({
      fromPath: draggedPath,
      toPath: nextPath,
    });
  };

  const handleEntryActivate = (entry: FileExplorerEntry) => {
    if (entry.type === "directory") {
      setCurrentPath(entry.path);
      setSelectedPath(null);
      return;
    }

    setSelectedPath(entry.path);
  };

  const renderEntry = (entry: FileExplorerEntry) => {
    const Icon = pickEntryIcon(entry);
    const isRenaming = renamingPath === entry.path;
    const isSelected = selectedPath === entry.path;
    const isDirectory = entry.type === "directory";
    const isDropTarget = isDirectory && dropTargetPath === entry.path;

    const actionMenu = (
      <div
        data-explorer-actions="true"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-foreground/45 hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded-xl border-border/80 bg-popover/95 backdrop-blur-xl"
          >
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                handleEntryActivate(entry);
              }}
            >
            {isDirectory ? "Open folder" : "Open file"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setRenamingPath(entry.path);
                setRenameDraft(entry.name);
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                setDeleteTarget(entry);
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );

    if (viewMode === "grid") {
      return (
        <div
          key={entry.path}
          role="button"
          tabIndex={0}
          draggable
          className={cn(
            "group rounded-[1.6rem] border border-border/75 bg-card/60 p-4 text-left transition-all",
            isSelected && "border-primary/35 bg-primary/8",
            isDropTarget && "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
          )}
          onClick={(event) => {
            if (isInteractiveTarget(event.target)) {
              return;
            }

            handleEntryActivate(entry);
          }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.target !== event.currentTarget || isInteractiveTarget(event.target)) {
              return;
            }

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleEntryActivate(entry);
            }
          }}
          onDragStart={() => setDraggedPath(entry.path)}
          onDragEnd={() => {
            setDraggedPath(null);
            setDropTargetPath(null);
          }}
          onDragOver={(event: DragEvent<HTMLDivElement>) => {
            if (!isDirectory) {
              return;
            }

            event.preventDefault();
            setDropTargetPath(entry.path);
          }}
          onDragLeave={() => setDropTargetPath(null)}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            if (!isDirectory) {
              return;
            }

            event.preventDefault();
            setDropTargetPath(null);
            dropEntryIntoDirectory(entry.path);
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-2xl border border-border/80 bg-background/55 p-3 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            {actionMenu}
          </div>

          {isRenaming ? (
            <div className="mt-4 space-y-2" onClick={(event) => event.stopPropagation()}>
              <Input
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitRename(entry);
                  }
                  if (event.key === "Escape") {
                    setRenamingPath(null);
                    setRenameDraft("");
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => submitRename(entry)}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRenamingPath(null);
                    setRenameDraft("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="truncate text-sm font-semibold text-foreground">{entry.name}</div>
              <div className="text-xs leading-6 text-foreground/52">
                {isDirectory ? "Folder" : `${entry.extension?.toUpperCase() ?? "File"} · ${formatEntrySize(entry.size)}`}
              </div>
              <div className="text-xs leading-6 text-foreground/42">{formatTimestamp(entry.modifiedAt)}</div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={entry.path}
        role="button"
        tabIndex={0}
        draggable
        className={cn(
          "group grid grid-cols-[minmax(0,1.3fr)_140px_150px_56px] items-center gap-4 rounded-2xl border border-border/70 bg-card/38 px-4 py-3 text-left transition-all",
          isSelected && "border-primary/35 bg-primary/8",
          isDropTarget && "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
        )}
        onClick={(event) => {
          if (isInteractiveTarget(event.target)) {
            return;
          }

          handleEntryActivate(entry);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.target !== event.currentTarget || isInteractiveTarget(event.target)) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleEntryActivate(entry);
          }
        }}
        onDragStart={() => setDraggedPath(entry.path)}
        onDragEnd={() => {
          setDraggedPath(null);
          setDropTargetPath(null);
        }}
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          if (!isDirectory) {
            return;
          }

          event.preventDefault();
          setDropTargetPath(entry.path);
        }}
        onDragLeave={() => setDropTargetPath(null)}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          if (!isDirectory) {
            return;
          }

          event.preventDefault();
          setDropTargetPath(null);
          dropEntryIntoDirectory(entry.path);
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl border border-border/80 bg-background/55 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          {isRenaming ? (
            <div className="flex min-w-0 flex-1 items-center gap-2" onClick={(event) => event.stopPropagation()}>
              <Input
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitRename(entry);
                  }
                  if (event.key === "Escape") {
                    setRenamingPath(null);
                    setRenameDraft("");
                  }
                }}
              />
              <Button type="button" size="icon" className="h-8 w-8" onClick={() => submitRename(entry)}>
                <Save className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setRenamingPath(null);
                  setRenameDraft("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{entry.name}</div>
              <div className="truncate text-xs text-foreground/48">
                {isDirectory ? "Folder" : entry.extension?.toUpperCase() ?? "File"}
              </div>
            </div>
          )}
        </div>

        <div className="text-sm text-foreground/58">
          {isDirectory ? "Directory" : formatEntrySize(entry.size)}
        </div>

        <div className="text-sm text-foreground/48">{formatTimestamp(entry.modifiedAt)}</div>

        <div className="flex justify-end">{actionMenu}</div>
      </div>
    );
  };

  const selectedFile = fileQuery.data;
  const previewEntry = selectedEntry;
  const previewError =
    fileQuery.error instanceof Error ? fileQuery.error.message : null;

  return (
    <main
      dir="ltr"
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_26%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_22%),linear-gradient(180deg,rgba(8,11,15,0.98),rgba(8,11,15,1))] px-4 py-6 text-left text-foreground md:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-[1800px] flex-col gap-6">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-border/75 bg-card/45 px-6 py-6 shadow-[0_40px_120px_-70px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/75 bg-background/45 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-foreground/56">
                Workspace Explorer
              </div>
              <div className="space-y-2">
                <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground md:text-[3.25rem]">
                  Files, folders, and live edits in one focused surface.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-foreground/58 md:text-base">
                  Browse the workspace tree, move content with drag and drop, and
                  edit text files without leaving the app shell.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 rounded-2xl border-border/75 bg-background/40 px-5"
                onClick={() => setLocation("/ide")}
              >
                <FileCode2 className="h-4 w-4" />
                Open IDE
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 rounded-2xl border-border/75 bg-background/40 px-5"
                onClick={() => setLocation("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-11 rounded-2xl px-5"
                onClick={() => refreshExplorer()}
                disabled={directoryQuery.isPending || directoryQuery.isRefetching}
              >
                {directoryQuery.isPending || directoryQuery.isRefetching ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/52">
            <div className="rounded-full border border-border/70 bg-background/35 px-4 py-2">
              {directoryMeta?.entries.length ?? 0} visible entries
            </div>
            <div className="rounded-full border border-border/60 px-4 py-2">
              Root: {directoryMeta?.rootName ?? "workspace"}
            </div>
            <div className="rounded-full border border-border/60 px-4 py-2 font-mono text-xs">
              {currentPath}
            </div>
          </div>
        </header>

        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[calc(100vh-14rem)] rounded-[2rem] border border-border/75 bg-card/35 shadow-[0_30px_120px_-80px_rgba(0,0,0,1)] backdrop-blur-xl"
        >
          <ResizablePanel defaultSize={22} minSize={18}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-foreground/42">
                    Tree
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    Folder structure
                  </div>
                </div>
                <div className="rounded-full border border-border/70 px-3 py-1 text-xs text-foreground/48">
                  Drag targets enabled
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                {directoryQuery.isPending && !directoryMeta ? (
                  <div className="flex h-full min-h-[280px] items-center justify-center text-foreground/52">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  </div>
                ) : directoryQuery.error instanceof Error ? (
                  <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/8 px-4 py-5 text-sm leading-7 text-destructive">
                    {directoryQuery.error.message}
                  </div>
                ) : directoryMeta?.tree ? (
                  <ExplorerTreeNode
                    node={directoryMeta.tree}
                    currentPath={currentPath}
                    expandedPaths={expandedPaths}
                    dropTargetPath={dropTargetPath}
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
                    onDropEntry={dropEntryIntoDirectory}
                    onDragTargetChange={setDropTargetPath}
                  />
                ) : null}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={48} minSize={34}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="space-y-4 border-b border-border/70 px-5 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <Breadcrumb>
                      <BreadcrumbList>
                        {(directoryMeta?.breadcrumbs ?? []).map((crumb, index, allCrumbs) => {
                          const isLast = index === allCrumbs.length - 1;
                          return (
                            <Fragment key={crumb.path}>
                              <BreadcrumbItem>
                                {isLast ? (
                                  <BreadcrumbPage className="font-medium">
                                    {crumb.name}
                                  </BreadcrumbPage>
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

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={viewMode === "list" ? "default" : "outline"}
                      className="h-10 rounded-xl px-4"
                      onClick={() => setViewMode("list")}
                    >
                      List
                    </Button>
                    <Button
                      type="button"
                      variant={viewMode === "grid" ? "default" : "outline"}
                      size="icon"
                      className="h-10 w-10 rounded-xl"
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid2x2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl px-4"
                      onClick={() => {
                        setCreateKind("file");
                        setCreateName("");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      New File
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl px-4"
                      onClick={() => {
                        setCreateKind("directory");
                        setCreateName("");
                      }}
                    >
                      <FolderPlus className="h-4 w-4" />
                      New Folder
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/36" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Filter the current folder"
                      className="h-11 rounded-2xl border-border/75 bg-background/40 pl-10"
                    />
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/28 px-4 py-3 text-sm text-foreground/50">
                    {filteredEntries.length} of {directoryMeta?.entries.length ?? 0} shown
                  </div>
                </div>

                {createKind ? (
                  <div className="flex flex-col gap-3 rounded-[1.5rem] border border-border/70 bg-background/35 p-4 md:flex-row md:items-center">
                    <Input
                      value={createName}
                      onChange={(event) => setCreateName(event.target.value)}
                      autoFocus
                      placeholder={
                        createKind === "directory"
                          ? "Enter a folder name"
                          : "Enter a file name"
                      }
                      className="h-11 rounded-xl border-border/75 bg-background/55"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void createMutation.mutateAsync({
                            type: createKind,
                            name: createName,
                          });
                        }
                        if (event.key === "Escape") {
                          setCreateKind(null);
                          setCreateName("");
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        className="h-11 rounded-xl px-4"
                        onClick={() =>
                          void createMutation.mutateAsync({
                            type: createKind,
                            name: createName,
                          })
                        }
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : null}
                        Create
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl px-4"
                        onClick={() => {
                          setCreateKind(null);
                          setCreateName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {directoryQuery.isPending && !directoryMeta ? (
                  <div className="flex h-full min-h-[340px] items-center justify-center text-foreground/52">
                    <LoaderCircle className="h-6 w-6 animate-spin" />
                  </div>
                ) : directoryQuery.error instanceof Error ? (
                  <div className="rounded-[1.75rem] border border-destructive/30 bg-destructive/8 p-6 text-sm leading-7 text-destructive">
                    {directoryQuery.error.message}
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <EmptyDirectoryState searchQuery={searchQuery} />
                ) : viewMode === "grid" ? (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {filteredEntries.map((entry) => renderEntry(entry))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-[minmax(0,1.3fr)_140px_150px_56px] gap-4 px-4 text-xs uppercase tracking-[0.2em] text-foreground/34">
                      <div>Name</div>
                      <div>Size</div>
                      <div>Modified</div>
                      <div />
                    </div>
                    {filteredEntries.map((entry) => renderEntry(entry))}
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={30} minSize={24}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-border/70 px-5 py-4">
                <div className="text-xs uppercase tracking-[0.22em] text-foreground/42">
                  Preview
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {previewEntry ? previewEntry.name : "No selection"}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {previewEntry ? (
                  <Card className="border-border/75 bg-card/52 shadow-none">
                    <CardHeader className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">{previewEntry.name}</CardTitle>
                          <div className="font-mono text-xs text-foreground/45">
                            {previewEntry.path}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/40 px-3 py-2 text-xs uppercase tracking-[0.18em] text-foreground/46">
                          {previewEntry.type}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/38">
                            Modified
                          </div>
                          <div className="mt-2 leading-6 text-foreground/72">
                            {formatTimestamp(previewEntry.modifiedAt)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/38">
                            Size
                          </div>
                          <div className="mt-2 leading-6 text-foreground/72">
                            {previewEntry.type === "file"
                              ? formatEntrySize(previewEntry.size)
                              : "Directory"}
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <Separator />

                      {previewEntry.type === "file" ? (
                        fileQuery.isPending ? (
                          <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] border border-border/70 bg-background/30 text-foreground/50">
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                          </div>
                        ) : previewError ? (
                          <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/8 px-4 py-5 text-sm leading-7 text-destructive">
                            {previewError}
                          </div>
                        ) : selectedFile?.isText && !selectedFile.truncated ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editorDraft}
                              onChange={(event) => setEditorDraft(event.target.value)}
                              className="min-h-[360px] rounded-[1.5rem] border-border/75 bg-background/40 font-mono text-sm leading-6"
                              spellCheck={false}
                            />
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm text-foreground/48">
                                {selectedFile.truncated
                                  ? "Large files cannot be previewed inline."
                                  : hasUnsavedEditorChanges
                                    ? "Unsaved changes"
                                    : "Everything is saved"}
                              </div>
                              <Button
                                type="button"
                                className="h-11 rounded-xl px-4"
                                onClick={() => {
                                  if (!previewEntry) {
                                    return;
                                  }

                                  void saveContentMutation.mutateAsync({
                                    path: previewEntry.path,
                                    content: editorDraft,
                                  });
                                }}
                                disabled={
                                  saveContentMutation.isPending ||
                                  !hasUnsavedEditorChanges ||
                                  selectedFile.truncated
                                }
                              >
                                {saveContentMutation.isPending ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                                Save changes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[1.5rem] border border-border/70 bg-background/30 px-4 py-6 text-sm leading-7 text-foreground/58">
                            Binary and non-text files are preview-only in this panel.
                            Use your OS tools or extend the explorer with a custom
                            preview pipeline for media and documents.
                          </div>
                        )
                      ) : (
                        <div className="rounded-[1.5rem] border border-border/70 bg-background/30 px-4 py-6 text-sm leading-7 text-foreground/58">
                          This folder is ready to receive dropped files. Use the tree on
                          the left or the content pane in the center to reorganize the
                          workspace structure.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border/70 bg-card/25 px-6 text-center">
                    <FileText className="h-10 w-10 text-foreground/28" />
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                      Select a file to inspect it
                    </h3>
                    <p className="mt-2 max-w-sm text-sm leading-7 text-foreground/52">
                      The detail pane will show file metadata, editable text content,
                      and quick save actions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-[1.75rem] border-border/80 bg-background/96">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-left">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left leading-7">
              This removes the selected file or folder from the workspace. Folder
              deletion is recursive and cannot be undone from this screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) {
                  return;
                }

                void deleteMutation.mutateAsync(deleteTarget);
              }}
            >
              {deleteMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
