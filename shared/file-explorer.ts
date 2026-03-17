export type FileSystemEntryType = "file" | "directory";

export interface FileExplorerEntry {
  type: FileSystemEntryType;
  name: string;
  path: string;
  extension: string | null;
  size: number;
  modifiedAt: string;
}

export interface FileExplorerTreeNode {
  name: string;
  path: string;
  children: FileExplorerTreeNode[];
}

export interface FileExplorerBreadcrumb {
  name: string;
  path: string;
}

export interface FileExplorerDirectoryResponse {
  rootName: string;
  currentPath: string;
  breadcrumbs: FileExplorerBreadcrumb[];
  entries: FileExplorerEntry[];
  tree: FileExplorerTreeNode;
}

export interface FileExplorerFileResponse {
  file: FileExplorerEntry;
  content: string | null;
  isText: boolean;
  truncated: boolean;
}
