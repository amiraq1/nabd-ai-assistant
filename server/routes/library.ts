import type { Express, Request, Response } from "express";
import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveSessionUserId } from "../auth/session-user.js";
import { db } from "../db.js";
import { storage } from "../storage.js";
import {
  findLibraryTaxonomyNode,
  flattenLibraryTaxonomy,
  libraryCheckoutSchema,
  libraryItemInputSchema,
  libraryMetadataSchema,
  libraryTaxonomyTree,
  type LibraryAccessLevel,
  type LibraryCatalogItemDetail,
  type LibraryCatalogItemSummary,
  type LibraryCatalogListResponse,
  type LibraryCatalogStats,
  type LibraryItemStatus,
  type LibraryLoanRecord,
  type LibraryMaterialFormat,
} from "../../shared/library-catalog.js";
import {
  libraryItems,
  libraryLoans,
  type LibraryItem,
  type LibraryLoan,
} from "../../shared/schema.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;
type LibraryItemInput = z.infer<typeof libraryItemInputSchema>;
type LibraryCheckoutInput = z.infer<typeof libraryCheckoutSchema>;
type DbLibraryItemInsert = typeof libraryItems.$inferInsert;
type DbLibraryLoanInsert = typeof libraryLoans.$inferInsert;

function isLibraryId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function resolveRequestUserId(req: Request, res: Response): string {
  const passportUser = (req as Request & { user?: unknown }).user;

  if (typeof passportUser === "string" && passportUser.trim()) {
    return passportUser.trim();
  }

  if (
    passportUser &&
    typeof passportUser === "object" &&
    typeof (passportUser as { id?: unknown }).id === "string" &&
    (passportUser as { id: string }).id.trim()
  ) {
    return (passportUser as { id: string }).id.trim();
  }

  return resolveSessionUserId(req, res);
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeMetadata(metadata: unknown, keywords: unknown) {
  const parsed = libraryMetadataSchema.safeParse({
    ...(metadata && typeof metadata === "object" ? metadata : {}),
    ...(Array.isArray(keywords) ? { keywords } : {}),
  });

  return parsed.success
    ? parsed.data
    : libraryMetadataSchema.parse({
        keywords: Array.isArray(keywords)
          ? keywords.filter((value): value is string => typeof value === "string")
          : [],
      });
}

function mapLoanRecord(loan: LibraryLoan): LibraryLoanRecord {
  return {
    id: loan.id,
    itemId: loan.itemId,
    borrowerName: loan.borrowerName,
    borrowerEmail: loan.borrowerEmail ?? null,
    note: loan.note,
    checkedOutAt: toIsoString(loan.checkedOutAt) ?? new Date().toISOString(),
    dueAt: toIsoString(loan.dueAt) ?? new Date().toISOString(),
    returnedAt: toIsoString(loan.returnedAt),
  };
}

function mapItemSummary(item: LibraryItem): LibraryCatalogItemSummary {
  return {
    id: item.id,
    title: item.title,
    creator: item.creator,
    format: item.format,
    subjectCode: item.subjectCode,
    subjectPath: item.subjectPath,
    classificationCode: item.classificationCode,
    classificationSystem: item.classificationSystem as "DDC" | "LCC" | "LOCAL",
    accessLevel: item.accessLevel,
    itemStatus: item.itemStatus,
    copiesTotal: item.copiesTotal,
    copiesAvailable: item.copiesAvailable,
    metadata: normalizeMetadata(item.metadata, item.keywords),
    createdAt: toIsoString(item.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(item.updatedAt) ?? new Date().toISOString(),
  };
}

function mapItemDetail(item: LibraryItem, loans: LibraryLoan[]): LibraryCatalogItemDetail {
  const summary = mapItemSummary(item);
  const mappedLoans = loans.map(mapLoanRecord);
  return {
    ...summary,
    description: item.description,
    activeLoan: mappedLoans.find((loan) => loan.returnedAt === null) ?? null,
    loanHistory: mappedLoans,
  };
}

function deriveSubjectPath(code: string): string {
  const node = findLibraryTaxonomyNode(code);
  return node ? node.path.join(" / ") : code;
}

function clampCopiesAvailable(copiesTotal: number, copiesAvailable?: number): number {
  if (copiesAvailable === undefined) return copiesTotal;
  return Math.max(0, Math.min(copiesTotal, copiesAvailable));
}

function getPageParams(query: Request["query"]) {
  const rawPage = typeof query.page === "string" ? Number.parseInt(query.page, 10) : 1;
  const rawPageSize =
    typeof query.pageSize === "string" ? Number.parseInt(query.pageSize, 10) : DEFAULT_PAGE_SIZE;

  return {
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize:
      Number.isFinite(rawPageSize) && rawPageSize > 0
        ? Math.min(rawPageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE,
  };
}

async function ensureCatalogUser(req: Request, res: Response): Promise<string> {
  const userId = resolveRequestUserId(req, res);
  await storage.ensureSessionUser(userId);
  return userId;
}

async function getItemDetail(userId: string, itemId: string): Promise<LibraryCatalogItemDetail | null> {
  const [item] = await db
    .select()
    .from(libraryItems)
    .where(and(eq(libraryItems.userId, userId), eq(libraryItems.id, itemId)))
    .limit(1);

  if (!item) return null;

  const loans = await db
    .select()
    .from(libraryLoans)
    .where(eq(libraryLoans.itemId, itemId))
    .orderBy(desc(libraryLoans.checkedOutAt), desc(libraryLoans.id));

  return mapItemDetail(item, loans);
}

function parseFormat(value: unknown): LibraryMaterialFormat | undefined {
  return typeof value === "string" &&
    ["book", "journal", "manuscript", "thesis", "dataset", "media", "archive", "digital_file"].includes(value)
    ? (value as LibraryMaterialFormat)
    : undefined;
}

function parseStatus(value: unknown): LibraryItemStatus | undefined {
  return typeof value === "string" &&
    ["available", "loaned", "reserved", "maintenance", "archived"].includes(value)
    ? (value as LibraryItemStatus)
    : undefined;
}

function parseAccessLevel(value: unknown): LibraryAccessLevel | undefined {
  return typeof value === "string" &&
    ["public", "restricted", "confidential"].includes(value)
    ? (value as LibraryAccessLevel)
    : undefined;
}

async function getStats(userId: string): Promise<LibraryCatalogStats> {
  const now = new Date();
  const [totalItems, availableItems, restrictedItems, digitalAssets, activeLoans, overdueLoans] =
    await Promise.all([
      db.select({ total: sql<number>`count(*)` }).from(libraryItems).where(eq(libraryItems.userId, userId)),
      db
        .select({ total: sql<number>`count(*)` })
        .from(libraryItems)
        .where(and(eq(libraryItems.userId, userId), sql`${libraryItems.copiesAvailable} > 0`)),
      db
        .select({ total: sql<number>`count(*)` })
        .from(libraryItems)
        .where(and(eq(libraryItems.userId, userId), ne(libraryItems.accessLevel, "public"))),
      db
        .select({ total: sql<number>`count(*)` })
        .from(libraryItems)
        .where(
          and(
            eq(libraryItems.userId, userId),
            or(
              inArray(libraryItems.format, ["dataset", "digital_file", "media", "archive"]),
              sql`${libraryItems.filePath} is not null`,
            ),
          ),
        ),
      db
        .select({ total: sql<number>`count(*)` })
        .from(libraryLoans)
        .innerJoin(libraryItems, eq(libraryLoans.itemId, libraryItems.id))
        .where(and(eq(libraryItems.userId, userId), isNull(libraryLoans.returnedAt))),
      db
        .select({ total: sql<number>`count(*)` })
        .from(libraryLoans)
        .innerJoin(libraryItems, eq(libraryLoans.itemId, libraryItems.id))
        .where(and(eq(libraryItems.userId, userId), isNull(libraryLoans.returnedAt), sql`${libraryLoans.dueAt} < ${now}`)),
    ]);

  return {
    totalItems: Number(totalItems[0]?.total ?? 0),
    availableItems: Number(availableItems[0]?.total ?? 0),
    activeLoans: Number(activeLoans[0]?.total ?? 0),
    digitalAssets: Number(digitalAssets[0]?.total ?? 0),
    restrictedItems: Number(restrictedItems[0]?.total ?? 0),
    overdueLoans: Number(overdueLoans[0]?.total ?? 0),
  };
}

async function listItems(
  userId: string,
  filters: {
    query?: string;
    subjectCode?: string;
    format?: LibraryMaterialFormat;
    status?: LibraryItemStatus;
    accessLevel?: LibraryAccessLevel;
    page: number;
    pageSize: number;
  },
): Promise<LibraryCatalogListResponse> {
  const conditions = [eq(libraryItems.userId, userId)];

  if (filters.query) {
    const term = `%${filters.query}%`;
    conditions.push(
      or(
        ilike(libraryItems.title, term),
        ilike(libraryItems.creator, term),
        ilike(libraryItems.subjectPath, term),
        ilike(libraryItems.classificationCode, term),
        ilike(libraryItems.isbn, term),
        ilike(libraryItems.filePath, term),
        sql`${libraryItems.keywords}::text ilike ${term}`,
      )!,
    );
  }
  if (filters.subjectCode) conditions.push(eq(libraryItems.subjectCode, filters.subjectCode));
  if (filters.format) conditions.push(eq(libraryItems.format, filters.format));
  if (filters.status) conditions.push(eq(libraryItems.itemStatus, filters.status));
  if (filters.accessLevel) conditions.push(eq(libraryItems.accessLevel, filters.accessLevel));

  const whereClause = and(...conditions);
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(libraryItems)
      .where(whereClause)
      .orderBy(desc(libraryItems.updatedAt), desc(libraryItems.id))
      .limit(filters.pageSize)
      .offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(libraryItems).where(whereClause),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: rows.map(mapItemSummary),
    pageInfo: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
    filters: {
      query: filters.query ?? null,
      subjectCode: filters.subjectCode ?? null,
      format: filters.format ?? null,
      status: filters.status ?? null,
      accessLevel: filters.accessLevel ?? null,
      availability: "all",
    },
  };
}

async function createItem(
  userId: string,
  input: LibraryItemInput,
): Promise<LibraryCatalogItemDetail> {
  const keywordList = Array.isArray(input.metadata.keywords)
    ? input.metadata.keywords.filter((value): value is string => typeof value === "string")
    : [];
  const payload: DbLibraryItemInsert = {
    userId,
    title: input.title,
    creator: input.creator,
    description: input.description,
    format: input.format,
    subjectCode: input.subjectCode,
    subjectPath: deriveSubjectPath(input.subjectCode),
    classificationSystem: input.classificationSystem,
    classificationCode: input.classificationCode,
    isbn: input.metadata.isbn,
    publisher: input.metadata.publisher,
    publicationYear: input.metadata.publicationYear,
    language: input.metadata.language ?? "en",
    keywords: keywordList,
    accessLevel: input.accessLevel,
    itemStatus:
      input.itemStatus === "loaned" && clampCopiesAvailable(input.copiesTotal, input.copiesAvailable) > 0
        ? "available"
        : input.itemStatus,
    copiesTotal: input.copiesTotal,
    copiesAvailable: clampCopiesAvailable(input.copiesTotal, input.copiesAvailable),
    shelfLocation: input.metadata.shelfLocation,
    filePath: input.metadata.filePath,
    mimeType: input.metadata.mimeType,
    metadata: input.metadata,
  };

  const [item] = await db.insert(libraryItems).values(payload).returning();
  return mapItemDetail(item, []);
}

async function updateItem(
  userId: string,
  itemId: string,
  updates: Partial<LibraryItemInput>,
): Promise<LibraryCatalogItemDetail | null> {
  const current = await getItemDetail(userId, itemId);
  if (!current) return null;

  const metadata = updates.metadata
    ? libraryMetadataSchema.parse({ ...current.metadata, ...updates.metadata })
    : current.metadata;
  const keywordList = Array.isArray(metadata.keywords)
    ? metadata.keywords.filter((value): value is string => typeof value === "string")
    : [];
  const copiesTotal = updates.copiesTotal ?? current.copiesTotal;
  const copiesAvailable = clampCopiesAvailable(
    copiesTotal,
    updates.copiesAvailable ?? current.copiesAvailable,
  );

  const [updated] = await db
    .update(libraryItems)
    .set({
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.creator !== undefined ? { creator: updates.creator } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.format !== undefined ? { format: updates.format } : {}),
      ...(updates.subjectCode !== undefined
        ? { subjectCode: updates.subjectCode, subjectPath: deriveSubjectPath(updates.subjectCode) }
        : {}),
      ...(updates.classificationSystem !== undefined ? { classificationSystem: updates.classificationSystem } : {}),
      ...(updates.classificationCode !== undefined ? { classificationCode: updates.classificationCode } : {}),
      ...(updates.accessLevel !== undefined ? { accessLevel: updates.accessLevel } : {}),
      ...(updates.itemStatus !== undefined ? { itemStatus: updates.itemStatus } : {}),
      ...(updates.copiesTotal !== undefined ? { copiesTotal } : {}),
      ...(updates.copiesAvailable !== undefined || updates.copiesTotal !== undefined ? { copiesAvailable } : {}),
      ...(updates.metadata !== undefined
        ? {
            isbn: metadata.isbn,
            publisher: metadata.publisher,
            publicationYear: metadata.publicationYear,
            language: metadata.language ?? "en",
            keywords: keywordList,
            shelfLocation: metadata.shelfLocation,
            filePath: metadata.filePath,
            mimeType: metadata.mimeType,
            metadata,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(libraryItems.userId, userId), eq(libraryItems.id, itemId)))
    .returning();

  return updated ? getItemDetail(userId, itemId) : null;
}

async function checkOutItem(
  userId: string,
  itemId: string,
  input: LibraryCheckoutInput,
): Promise<LibraryCatalogItemDetail | null> {
  const current = await getItemDetail(userId, itemId);
  if (!current) return null;
  if (
    current.accessLevel === "confidential" ||
    current.itemStatus === "maintenance" ||
    current.itemStatus === "archived"
  ) {
    throw new Error("This item cannot be checked out under the current access policy.");
  }
  if (current.copiesAvailable <= 0) {
    throw new Error("No copies are available for checkout.");
  }

  await db.transaction(async (tx) => {
      const loanValues: DbLibraryLoanInsert = {
      itemId,
      createdByUserId: userId,
      borrowerName: input.borrowerName,
      borrowerEmail: input.borrowerEmail,
      note: input.note ?? "",
      dueAt: new Date(input.dueAt),
    };
    await tx.insert(libraryLoans).values(loanValues);
    await tx
      .update(libraryItems)
      .set({
        copiesAvailable: current.copiesAvailable - 1,
        itemStatus: current.copiesAvailable - 1 > 0 ? "available" : "loaned",
        updatedAt: new Date(),
      })
      .where(and(eq(libraryItems.id, itemId), eq(libraryItems.userId, userId)));
  });

  return getItemDetail(userId, itemId);
}

async function checkInItem(userId: string, itemId: string): Promise<LibraryCatalogItemDetail | null> {
  const current = await getItemDetail(userId, itemId);
  if (!current) return null;
  const activeLoan = current.loanHistory.find((loan) => loan.returnedAt === null);
  if (!activeLoan) {
    throw new Error("No active loan is registered for this item.");
  }

  await db.transaction(async (tx) => {
    await tx.update(libraryLoans).set({ returnedAt: new Date() }).where(eq(libraryLoans.id, activeLoan.id));
    await tx
      .update(libraryItems)
      .set({
        copiesAvailable: Math.min(current.copiesTotal, current.copiesAvailable + 1),
        itemStatus:
          current.itemStatus === "archived" || current.itemStatus === "maintenance"
            ? current.itemStatus
            : "available",
        updatedAt: new Date(),
      })
      .where(and(eq(libraryItems.id, itemId), eq(libraryItems.userId, userId)));
  });

  return getItemDetail(userId, itemId);
}

export function registerLibraryRoutes(app: Express): void {
  app.get("/api/library/taxonomy", (_req, res) => {
    return res.json({
      tree: libraryTaxonomyTree,
      flat: flattenLibraryTaxonomy(libraryTaxonomyTree),
    });
  });

  app.get("/api/library/stats", async (req, res) => {
    try {
      return res.json(await getStats(await ensureCatalogUser(req, res)));
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "Failed to load library stats" });
    }
  });

  app.get("/api/library/items", async (req, res) => {
    try {
      const { page, pageSize } = getPageParams(req.query);
      return res.json(
        await listItems(await ensureCatalogUser(req, res), {
          page,
          pageSize,
          query: typeof req.query.query === "string" ? req.query.query.trim() : undefined,
          subjectCode: typeof req.query.subjectCode === "string" ? req.query.subjectCode.trim() : undefined,
          format: parseFormat(req.query.format),
          status: parseStatus(req.query.status),
          accessLevel: parseAccessLevel(req.query.accessLevel),
        }),
      );
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "Failed to load catalog items" });
    }
  });

  app.get("/api/library/items/:id", async (req, res) => {
    const itemId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!isLibraryId(itemId)) return res.status(404).json({ message: "Catalog item not found" });
    const item = await getItemDetail(await ensureCatalogUser(req, res), itemId);
    return item ? res.json(item) : res.status(404).json({ message: "Catalog item not found" });
  });

  app.post("/api/library/items", async (req, res) => {
    const parsed = libraryItemInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid catalog item payload" });
    try {
      return res.status(201).json(await createItem(await ensureCatalogUser(req, res), parsed.data));
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "Failed to catalog item" });
    }
  });

  app.patch("/api/library/items/:id", async (req, res) => {
    const itemId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!isLibraryId(itemId)) return res.status(404).json({ message: "Catalog item not found" });
    const parsed = libraryItemInputSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid update payload" });
    const item = await updateItem(await ensureCatalogUser(req, res), itemId, parsed.data);
    return item ? res.json(item) : res.status(404).json({ message: "Catalog item not found" });
  });

  app.post("/api/library/items/:id/check-out", async (req, res) => {
    const itemId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!isLibraryId(itemId)) return res.status(404).json({ message: "Catalog item not found" });
    const parsed = libraryCheckoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid checkout payload" });
    try {
      const item = await checkOutItem(await ensureCatalogUser(req, res), itemId, parsed.data);
      return item ? res.json(item) : res.status(404).json({ message: "Catalog item not found" });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to check out item" });
    }
  });

  app.post("/api/library/items/:id/check-in", async (req, res) => {
    const itemId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!isLibraryId(itemId)) return res.status(404).json({ message: "Catalog item not found" });
    try {
      const item = await checkInItem(await ensureCatalogUser(req, res), itemId);
      return item ? res.json(item) : res.status(404).json({ message: "Catalog item not found" });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to check in item" });
    }
  });
}
