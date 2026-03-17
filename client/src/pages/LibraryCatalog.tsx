import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ArrowLeft,
  BookOpen,
  LibraryBig,
  LoaderCircle,
  Search,
  Undo2,
} from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  libraryCirculationPolicies,
  libraryTaxonomyTree,
  type LibraryAccessLevel,
  type LibraryCatalogItemDetail,
  type LibraryCatalogListResponse,
  type LibraryCatalogStats,
  type LibraryItemStatus,
  type LibraryMaterialFormat,
  type LibraryTaxonomyNode,
} from "@shared/library-catalog";

type TaxonomyResponse = { tree: LibraryTaxonomyNode[] };

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "include" }).then(async (response) => {
    if (!response.ok) throw new Error((await response.text()) || response.statusText);
    return (await response.json()) as T;
  });
}

function tone(status: LibraryItemStatus): string {
  if (status === "available") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "loaned") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (status === "maintenance") return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  return "border-white/10 bg-white/10 text-white/72";
}

function TaxonomyNodeButton({
  node,
  selectedCode,
  depth = 0,
  onSelect,
}: {
  node: LibraryTaxonomyNode;
  selectedCode: string | null;
  depth?: number;
  onSelect: (code: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(node.code)}
        className={cn(
          "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
          selectedCode === node.code
            ? "border-cyan-300/30 bg-cyan-300/12 text-white"
            : "border-white/8 bg-white/[0.02] text-white/72 hover:bg-white/[0.05]",
        )}
        style={{ marginLeft: depth * 12 }}
      >
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">{node.code}</div>
        <div className="mt-1 font-medium">{node.label}</div>
      </button>
      {(node.children ?? []).map((child) => (
        <TaxonomyNodeButton
          key={child.code}
          node={child}
          selectedCode={selectedCode}
          depth={depth + 1}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default function LibraryCatalog() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [subjectCode, setSubjectCode] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<LibraryMaterialFormat | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LibraryItemStatus | "all">("all");
  const [accessFilter, setAccessFilter] = useState<LibraryAccessLevel | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [borrowerName, setBorrowerName] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [classificationCode, setClassificationCode] = useState("020");
  const [keywords, setKeywords] = useState("");
  const deferredSearch = useDeferredValue(search);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "12");
    if (deferredSearch.trim()) params.set("query", deferredSearch.trim());
    if (subjectCode) params.set("subjectCode", subjectCode);
    if (formatFilter !== "all") params.set("format", formatFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (accessFilter !== "all") params.set("accessLevel", accessFilter);
    return `/api/library/items?${params.toString()}`;
  }, [accessFilter, deferredSearch, formatFilter, page, statusFilter, subjectCode]);

  const taxonomyQuery = useQuery({
    queryKey: ["/api/library/taxonomy"],
    queryFn: () => fetchJson<TaxonomyResponse>("/api/library/taxonomy"),
  });
  const statsQuery = useQuery({
    queryKey: ["/api/library/stats"],
    queryFn: () => fetchJson<LibraryCatalogStats>("/api/library/stats"),
  });
  const itemsQuery = useQuery({
    queryKey: ["/api/library/items", listUrl],
    queryFn: () => fetchJson<LibraryCatalogListResponse>(listUrl),
  });
  const detailQuery = useQuery({
    queryKey: ["/api/library/items", selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => fetchJson<LibraryCatalogItemDetail>(`/api/library/items/${selectedId}`),
  });

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, subjectCode, formatFilter, statusFilter, accessFilter]);

  useEffect(() => {
    const items = itemsQuery.data?.items ?? [];
    if (!items.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [itemsQuery.data?.items, selectedId]);

  const invalidateCatalog = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/library/items"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/library/stats"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/library/items", selectedId] }),
    ]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/library/items", {
        title,
        creator,
        description: "",
        format: "book",
        subjectCode: subjectCode ?? "020",
        classificationSystem: "DDC",
        classificationCode,
        accessLevel: "public",
        itemStatus: "available",
        copiesTotal: 1,
        metadata: {
          keywords: keywords
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      });
      return (await response.json()) as LibraryCatalogItemDetail;
    },
    onSuccess: async (created) => {
      await invalidateCatalog();
      setSelectedId(created.id);
      setTitle("");
      setCreator("");
      setKeywords("");
      toast({ title: "Catalog item created", description: created.title });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Cataloging failed",
        description: error instanceof Error ? error.message : "Could not catalog item.",
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Select a record first.");
      const response = await apiRequest("POST", `/api/library/items/${selectedId}/check-out`, {
        borrowerName,
        dueAt: new Date(`${dueAt}T12:00:00`).toISOString(),
      });
      return (await response.json()) as LibraryCatalogItemDetail;
    },
    onSuccess: async () => {
      await invalidateCatalog();
      setBorrowerName("");
      setDueAt("");
      toast({ title: "Item checked out", description: "Circulation updated." });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Could not check out item.",
      });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Select a record first.");
      const response = await apiRequest("POST", `/api/library/items/${selectedId}/check-in`);
      return (await response.json()) as LibraryCatalogItemDetail;
    },
    onSuccess: async () => {
      await invalidateCatalog();
      toast({ title: "Item checked in", description: "Inventory returned to shelf." });
    },
  });

  const stats = statsQuery.data;
  const selectedItem = detailQuery.data;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0908]" dir="ltr">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_30%)]" />
      <main className="relative z-10 mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-6 md:px-8">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl space-y-4">
            <Badge variant="outline" className="w-fit rounded-full border-amber-300/20 bg-amber-300/10 text-amber-100">LIBRARY_ORDER_COMMAND</Badge>
            <div className="space-y-3">
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl">A disciplined catalog for physical holdings and digital assets.</h1>
              <p className="max-w-3xl text-sm leading-7 text-white/60">Classify every asset, attach reliable metadata, search across the archive in seconds, and keep circulation in sync with inventory.</p>
            </div>
          </div>
          <Button type="button" variant="outline" className="w-fit rounded-2xl" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </header>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1.1fr)_400px]">
          <aside className="space-y-6">
            <Card className="border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white"><Search className="h-5 w-5 text-amber-200" />Findability Controls</CardTitle>
                <CardDescription className="text-white/55">Search, narrow by taxonomy, and constrain the archive before browsing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, creator, ISBN, keywords" className="bg-black/20 text-white" />
                <select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value as LibraryMaterialFormat | "all")} className="flex h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white">
                  <option value="all" className="bg-stone-950">All formats</option>
                  <option value="book" className="bg-stone-950">Books</option>
                  <option value="journal" className="bg-stone-950">Journals</option>
                  <option value="dataset" className="bg-stone-950">Datasets</option>
                  <option value="digital_file" className="bg-stone-950">Digital Files</option>
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LibraryItemStatus | "all")} className="flex h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white">
                  <option value="all" className="bg-stone-950">All statuses</option>
                  <option value="available" className="bg-stone-950">Available</option>
                  <option value="loaned" className="bg-stone-950">Loaned</option>
                  <option value="maintenance" className="bg-stone-950">Maintenance</option>
                  <option value="archived" className="bg-stone-950">Archived</option>
                </select>
                <select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value as LibraryAccessLevel | "all")} className="flex h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white">
                  <option value="all" className="bg-stone-950">All access</option>
                  <option value="public" className="bg-stone-950">Public</option>
                  <option value="restricted" className="bg-stone-950">Restricted</option>
                  <option value="confidential" className="bg-stone-950">Confidential</option>
                </select>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.04]">
              <CardHeader><CardTitle className="flex items-center gap-3 text-white"><LibraryBig className="h-5 w-5 text-cyan-200" />Taxonomy Tree</CardTitle></CardHeader>
              <CardContent>
                <Button type="button" variant="ghost" className="mb-3 rounded-xl border border-white/10 text-white/75" onClick={() => setSubjectCode(null)}>All subjects</Button>
                <ScrollArea className="h-[520px] pr-3">
                  <div className="space-y-3">
                    {(taxonomyQuery.data?.tree ?? libraryTaxonomyTree).map((node) => (
                      <TaxonomyNodeButton key={node.code} node={node} selectedCode={subjectCode} onSelect={setSubjectCode} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              {stats ? (
                <>
                  <Card className="border-white/10 bg-white/[0.04]"><CardContent className="px-5 py-5"><div className="text-xs uppercase tracking-[0.2em] text-white/42">Assets</div><div className="mt-3 text-3xl font-semibold text-white">{stats.totalItems}</div></CardContent></Card>
                  <Card className="border-white/10 bg-white/[0.04]"><CardContent className="px-5 py-5"><div className="text-xs uppercase tracking-[0.2em] text-white/42">Available</div><div className="mt-3 text-3xl font-semibold text-white">{stats.availableItems}</div></CardContent></Card>
                  <Card className="border-white/10 bg-white/[0.04]"><CardContent className="px-5 py-5"><div className="text-xs uppercase tracking-[0.2em] text-white/42">Loans</div><div className="mt-3 text-3xl font-semibold text-white">{stats.activeLoans}</div></CardContent></Card>
                  <Card className="border-white/10 bg-white/[0.04]"><CardContent className="px-5 py-5"><div className="text-xs uppercase tracking-[0.2em] text-white/42">Digital</div><div className="mt-3 text-3xl font-semibold text-white">{stats.digitalAssets}</div></CardContent></Card>
                </>
              ) : Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 bg-white/10" />)}
            </div>

            <Card className="border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-white">Catalog Records</CardTitle>
                <CardDescription className="text-white/55">Ordered retrieval with pagination and discipline around every record.</CardDescription>
              </CardHeader>
              <CardContent>
                {itemsQuery.isPending ? (
                  <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 bg-white/10" />)}</div>
                ) : itemsQuery.data?.items.length ? (
                  <>
                    <Table>
                      <TableHeader><TableRow className="border-white/10 hover:bg-transparent"><TableHead className="text-white/45">Title</TableHead><TableHead className="text-white/45">Class</TableHead><TableHead className="text-white/45">Availability</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {itemsQuery.data.items.map((item) => (
                          <TableRow key={item.id} className={cn("cursor-pointer border-white/8 hover:bg-white/[0.04]", selectedId === item.id && "bg-white/[0.05]")} onClick={() => setSelectedId(item.id)}>
                            <TableCell><div className="font-medium text-white">{item.title}</div><div className="mt-1 text-xs text-white/45">{item.creator} · {item.subjectPath}</div></TableCell>
                            <TableCell className="font-mono text-xs text-white/72">{item.classificationCode}</TableCell>
                            <TableCell><Badge variant="outline" className={cn("rounded-full", tone(item.itemStatus))}>{item.itemStatus}</Badge><div className="mt-2 text-xs text-white/45">{item.copiesAvailable}/{item.copiesTotal} available</div></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-5 flex items-center justify-between">
                      <div className="text-xs text-white/45">Page {itemsQuery.data.pageInfo.page} of {itemsQuery.data.pageInfo.pageCount}</div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
                        <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={page >= itemsQuery.data.pageInfo.pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <Alert className="border-white/10 bg-black/20 text-white/75"><BookOpen className="h-4 w-4" /><AlertTitle>No records matched the active filters.</AlertTitle><AlertDescription>Catalog a new asset or relax the query and taxonomy constraints.</AlertDescription></Alert>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              {libraryCirculationPolicies.map((policy) => (
                <Card key={policy.title} className="border-white/10 bg-white/[0.04]"><CardContent className="px-5 py-5"><div className="text-sm font-semibold text-white">{policy.title}</div><div className="mt-2 text-sm leading-7 text-white/58">{policy.description}</div></CardContent></Card>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <Card className="border-white/10 bg-white/[0.04]">
              <CardHeader><CardTitle className="text-white">Selected Record</CardTitle><CardDescription className="text-white/55">Metadata, access state, and circulation control.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {selectedId && detailQuery.isPending ? (
                  <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 bg-white/10" />)}</div>
                ) : selectedItem ? (
                  <>
                    <div className="space-y-2"><div className="text-2xl font-semibold text-white">{selectedItem.title}</div><div className="text-sm text-white/55">{selectedItem.creator}</div><Badge variant="outline" className={cn("rounded-full", tone(selectedItem.itemStatus))}>{selectedItem.itemStatus}</Badge></div>
                    <div className="grid gap-2 text-sm text-white/68">
                      <div>Subject: <span className="text-white">{selectedItem.subjectPath}</span></div>
                      <div>Classification: <span className="font-mono text-white">{selectedItem.classificationCode}</span></div>
                      <div>Updated: <span className="text-white">{formatDistanceToNowStrict(new Date(selectedItem.updatedAt), { addSuffix: true, locale: enUS })}</span></div>
                      {selectedItem.metadata.keywords.length ? <div>Keywords: <span className="text-white">{selectedItem.metadata.keywords.join(", ")}</span></div> : null}
                    </div>
                    <Input value={borrowerName} onChange={(event) => setBorrowerName(event.target.value)} placeholder="Borrower name" className="bg-black/20 text-white" />
                    <Input value={dueAt} onChange={(event) => setDueAt(event.target.value)} type="date" className="bg-black/20 text-white" />
                    <div className="flex gap-3">
                      <Button type="button" className="flex-1 rounded-2xl" disabled={checkoutMutation.isPending || selectedItem.copiesAvailable === 0 || !borrowerName || !dueAt} onClick={() => checkoutMutation.mutate()}>{checkoutMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}Check Out</Button>
                      <Button type="button" variant="outline" className="flex-1 rounded-2xl" disabled={checkinMutation.isPending || !selectedItem.activeLoan} onClick={() => checkinMutation.mutate()}>{checkinMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}Check In</Button>
                    </div>
                  </>
                ) : <div className="text-sm leading-7 text-white/55">Select a record from the catalog to inspect metadata and circulation state.</div>}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.04]">
              <CardHeader><CardTitle className="text-white">Quick Catalog</CardTitle><CardDescription className="text-white/55">Minimal metadata capture to bring a messy archive under control fast.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="bg-black/20 text-white" />
                <Input value={creator} onChange={(event) => setCreator(event.target.value)} placeholder="Author / creator" className="bg-black/20 text-white" />
                <Input value={classificationCode} onChange={(event) => setClassificationCode(event.target.value)} placeholder="Classification code" className="bg-black/20 text-white" />
                <Textarea value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="Keywords, comma-separated" className="min-h-[90px] bg-black/20 text-white" />
                <Button type="button" className="w-full rounded-2xl" disabled={createMutation.isPending || !title || !creator} onClick={() => createMutation.mutate()}>{createMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}Catalog Item</Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
