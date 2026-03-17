import { promises as fs } from "fs";
import path from "path";
import type { Express } from "express";
import type {
  FileExplorerBreadcrumb,
  FileExplorerDirectoryResponse,
  FileExplorerEntry,
  FileExplorerFileResponse,
  FileExplorerTreeNode,
} from "../../shared/file-explorer.js";

const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
]);
const TEXT_PREVIEW_BYTES_LIMIT = 512 * 1024;
const TEXT_EXTENSIONS = new Set([
  "c",
  "cc",
  "css",
  "csv",
  "env",
  "gitignore",
  "html",
  "java",
  "js",
  "json",
  "jsx",
  "log",
  "md",
  "mjs",
  "py",
  "scss",
  "sh",
  "sql",
  "svg",
  "toml",
  "ts",
  "tsx",
  "txt",
  "vue",
  "xml",
  "yaml",
  "yml",
]);
const MIME_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  gif: "image/gif",
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  ts: "text/plain; charset=utf-8",
  tsx: "text/plain; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  webp: "image/webp",
  xml: "application/xml; charset=utf-8",
};
const WORKSPACE_ROOT = path.resolve(process.cwd());
const WORKSPACE_ROOT_NAME = path.basename(WORKSPACE_ROOT);

function normalizeExplorerPath(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) {
    return "/";
  }

  const normalized = path.posix.normalize(`/${input.trim().replace(/\\/g, "/")}`);
  if (normalized === "/." || normalized === "") {
    return "/";
  }

  if (!normalized.startsWith("/")) {
    throw new Error("Invalid path");
  }

  if (normalized.split("/").includes("..")) {
    throw new Error("Invalid path");
  }

  return normalized;
}

function resolveAbsolutePath(explorerPath: string): string {
  const relativePath =
    explorerPath === "/"
      ? ""
      : explorerPath
          .slice(1)
          .split("/")
          .join(path.sep);
  const absolutePath = path.resolve(WORKSPACE_ROOT, relativePath);

  if (
    absolutePath !== WORKSPACE_ROOT &&
    !absolutePath.startsWith(`${WORKSPACE_ROOT}${path.sep}`)
  ) {
    throw new Error("Path escapes the workspace root");
  }

  return absolutePath;
}

function toExplorerPath(absolutePath: string): string {
  const relativePath = path.relative(WORKSPACE_ROOT, absolutePath);
  if (!relativePath) {
    return "/";
  }

  return `/${relativePath.split(path.sep).join("/")}`;
}

function getExtension(name: string): string | null {
  const extension = path.extname(name).slice(1).toLowerCase();
  return extension || null;
}

function getContentType(name: string): string {
  return MIME_TYPES[getExtension(name) ?? ""] ?? "application/octet-stream";
}

function isVisibleEntry(dirent: { isDirectory(): boolean; isSymbolicLink(): boolean; name: string }) {
  if (dirent.isSymbolicLink()) {
    return false;
  }

  if (dirent.isDirectory() && EXCLUDED_DIRECTORY_NAMES.has(dirent.name)) {
    return false;
  }

  return true;
}

function sortByExplorerOrder<T extends { name: string; type: "file" | "directory" }>(
  left: T,
  right: T,
) {
  if (left.type !== right.type) {
    return left.type === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function buildEntry(
  absolutePath: string,
  stats: { isDirectory(): boolean; size: number; mtime: Date },
): FileExplorerEntry {
  const name = path.basename(absolutePath);
  return {
    type: stats.isDirectory() ? "directory" : "file",
    name,
    path: toExplorerPath(absolutePath),
    extension: stats.isDirectory() ? null : getExtension(name),
    size: stats.isDirectory() ? 0 : stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };
}

function buildBreadcrumbs(currentPath: string): FileExplorerBreadcrumb[] {
  if (currentPath === "/") {
    return [{ name: WORKSPACE_ROOT_NAME, path: "/" }];
  }

  const parts = currentPath.split("/").filter(Boolean);
  const breadcrumbs: FileExplorerBreadcrumb[] = [
    { name: WORKSPACE_ROOT_NAME, path: "/" },
  ];

  let partialPath = "";
  for (const part of parts) {
    partialPath += `/${part}`;
    breadcrumbs.push({
      name: part,
      path: partialPath,
    });
  }

  return breadcrumbs;
}

function isValidEntryName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") {
    return false;
  }

  return !/[\\/]/.test(trimmed);
}

function buildDestinationPath(parentPath: string, entryName: string): string {
  if (parentPath === "/") {
    return `/${entryName}`;
  }

  return `${parentPath}/${entryName}`;
}

async function readDirectoryEntries(directoryPath: string): Promise<FileExplorerEntry[]> {
  const dirents = await fs.readdir(directoryPath, { withFileTypes: true });
  const visibleDirents = dirents.filter(isVisibleEntry);

  const entries = await Promise.all(
    visibleDirents.map(async (dirent) => {
      const entryPath = path.join(directoryPath, dirent.name);
      const stats = await fs.stat(entryPath);
      return buildEntry(entryPath, stats);
    }),
  );

  return entries.sort(sortByExplorerOrder);
}

async function buildDirectoryTree(directoryPath: string): Promise<FileExplorerTreeNode> {
  const dirents = await fs.readdir(directoryPath, { withFileTypes: true });
  const children = await Promise.all(
    dirents
      .filter((dirent) => dirent.isDirectory() && isVisibleEntry(dirent))
      .map(async (dirent) => buildDirectoryTree(path.join(directoryPath, dirent.name))),
  );

  return {
    name: directoryPath === WORKSPACE_ROOT ? WORKSPACE_ROOT_NAME : path.basename(directoryPath),
    path: toExplorerPath(directoryPath),
    children: children.sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    ),
  };
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function isTextFile(
  absolutePath: string,
  extension: string | null,
  size: number,
): Promise<{ isText: boolean; truncated: boolean }> {
  if (size > TEXT_PREVIEW_BYTES_LIMIT) {
    return {
      isText: TEXT_EXTENSIONS.has(extension ?? ""),
      truncated: TEXT_EXTENSIONS.has(extension ?? ""),
    };
  }

  if (TEXT_EXTENSIONS.has(extension ?? "")) {
    return { isText: true, truncated: false };
  }

  const sample = await fs.readFile(absolutePath);
  const hasBinaryContent = sample.includes(0);
  return {
    isText: !hasBinaryContent,
    truncated: false,
  };
}

export function registerFileExplorerRoutes(app: Express): void {
  app.get("/api/files", async (req, res) => {
    try {
      const currentPath = normalizeExplorerPath(req.query.path);
      const absolutePath = resolveAbsolutePath(currentPath);
      const stats = await fs.stat(absolutePath);

      if (!stats.isDirectory()) {
        return res.status(400).json({ message: "The requested path is not a directory." });
      }

      const [entries, tree] = await Promise.all([
        readDirectoryEntries(absolutePath),
        buildDirectoryTree(WORKSPACE_ROOT),
      ]);

      const payload: FileExplorerDirectoryResponse = {
        rootName: WORKSPACE_ROOT_NAME,
        currentPath,
        breadcrumbs: buildBreadcrumbs(currentPath),
        entries,
        tree,
      };

      return res.json(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to read the directory.";
      const status = message.includes("no such file") ? 404 : 400;
      return res.status(status).json({ message });
    }
  });

  app.get("/api/files/content", async (req, res) => {
    try {
      const filePath = normalizeExplorerPath(req.query.path);
      const absolutePath = resolveAbsolutePath(filePath);
      const stats = await fs.stat(absolutePath);

      if (!stats.isFile()) {
        return res.status(400).json({ message: "The requested path is not a file." });
      }

      const entry = buildEntry(absolutePath, stats);
      const previewInfo = await isTextFile(absolutePath, entry.extension, stats.size);
      let content: string | null = null;

      if (previewInfo.isText && !previewInfo.truncated) {
        content = await fs.readFile(absolutePath, "utf8");
      }

      const payload: FileExplorerFileResponse = {
        file: entry,
        content,
        isText: previewInfo.isText,
        truncated: previewInfo.truncated,
      };

      return res.json(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to read the file.";
      const status = message.includes("no such file") ? 404 : 400;
      return res.status(status).json({ message });
    }
  });

  app.get("/api/files/raw", async (req, res) => {
    try {
      const filePath = normalizeExplorerPath(req.query.path);
      const absolutePath = resolveAbsolutePath(filePath);
      const stats = await fs.stat(absolutePath);

      if (!stats.isFile()) {
        return res.status(400).json({ message: "The requested path is not a file." });
      }

      res.setHeader("Content-Type", getContentType(path.basename(absolutePath)));
      res.setHeader("Cache-Control", "no-store");
      return res.sendFile(absolutePath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to stream the file.";
      const status = message.includes("no such file") ? 404 : 400;
      return res.status(status).json({ message });
    }
  });

  app.post("/api/files", async (req, res) => {
    try {
      const parentPath = normalizeExplorerPath(req.body?.parentPath);
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const type = req.body?.type;
      const content = typeof req.body?.content === "string" ? req.body.content : "";

      if (!isValidEntryName(name)) {
        return res.status(400).json({ message: "A valid file or folder name is required." });
      }

      if (type !== "file" && type !== "directory") {
        return res.status(400).json({ message: "type must be file or directory." });
      }

      const parentAbsolutePath = resolveAbsolutePath(parentPath);
      const parentStats = await fs.stat(parentAbsolutePath);
      if (!parentStats.isDirectory()) {
        return res.status(400).json({ message: "parentPath must point to a directory." });
      }

      const nextPath = buildDestinationPath(parentPath, name);
      const nextAbsolutePath = resolveAbsolutePath(nextPath);

      if (await pathExists(nextAbsolutePath)) {
        return res.status(409).json({ message: "A file or folder with that name already exists." });
      }

      if (type === "directory") {
        await fs.mkdir(nextAbsolutePath);
      } else {
        await fs.writeFile(nextAbsolutePath, content, "utf8");
      }

      const nextStats = await fs.stat(nextAbsolutePath);
      return res.status(201).json(buildEntry(nextAbsolutePath, nextStats));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create the entry.";
      return res.status(400).json({ message });
    }
  });

  app.patch("/api/files", async (req, res) => {
    try {
      const fromPath = normalizeExplorerPath(req.body?.fromPath);
      const toPath = normalizeExplorerPath(req.body?.toPath);

      if (fromPath === "/") {
        return res.status(400).json({ message: "The workspace root cannot be moved." });
      }

      if (fromPath === toPath) {
        return res.json({ success: true, path: toPath });
      }

      const fromAbsolutePath = resolveAbsolutePath(fromPath);
      const toAbsolutePath = resolveAbsolutePath(toPath);

      const fromStats = await fs.stat(fromAbsolutePath);
      const targetParentStats = await fs.stat(path.dirname(toAbsolutePath));
      if (!targetParentStats.isDirectory()) {
        return res.status(400).json({ message: "The destination parent is invalid." });
      }

      if (
        fromStats.isDirectory() &&
        (toAbsolutePath === fromAbsolutePath || toAbsolutePath.startsWith(`${fromAbsolutePath}${path.sep}`))
      ) {
        return res.status(400).json({ message: "A folder cannot be moved inside itself." });
      }

      if (await pathExists(toAbsolutePath)) {
        return res.status(409).json({ message: "The destination already exists." });
      }

      await fs.rename(fromAbsolutePath, toAbsolutePath);

      const nextStats = await fs.stat(toAbsolutePath);
      return res.json(buildEntry(toAbsolutePath, nextStats));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to move the entry.";
      const status = message.includes("no such file") ? 404 : 400;
      return res.status(status).json({ message });
    }
  });

  app.put("/api/files/content", async (req, res) => {
    try {
      const filePath = normalizeExplorerPath(req.body?.path);
      const content = typeof req.body?.content === "string" ? req.body.content : null;
      if (content === null) {
        return res.status(400).json({ message: "content is required." });
      }

      const absolutePath = resolveAbsolutePath(filePath);
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        return res.status(400).json({ message: "The requested path is not a file." });
      }

      const previewInfo = await isTextFile(absolutePath, getExtension(path.basename(absolutePath)), stats.size);
      if (!previewInfo.isText) {
        return res.status(415).json({ message: "Binary files cannot be edited inline." });
      }

      await fs.writeFile(absolutePath, content, "utf8");
      const nextStats = await fs.stat(absolutePath);
      return res.json(buildEntry(absolutePath, nextStats));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save the file.";
      const status = message.includes("no such file") ? 404 : 400;
      return res.status(status).json({ message });
    }
  });

  app.delete("/api/files", async (req, res) => {
    try {
      const targetPath = normalizeExplorerPath(req.body?.path);
      if (targetPath === "/") {
        return res.status(400).json({ message: "The workspace root cannot be deleted." });
      }

      const absolutePath = resolveAbsolutePath(targetPath);
      await fs.rm(absolutePath, {
        force: false,
        recursive: true,
      });

      return res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete the entry.";
      const status = message.includes("no such file") ? 404 : 400;
      return res.status(status).json({ message });
    }
  });
}
