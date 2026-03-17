export interface CursorPageOptions {
  limit?: number;
  cursor?: string;
}

export interface CursorPageInfo {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface CursorPageResult<T> {
  items: T[];
  pageInfo: CursorPageInfo;
}

export interface TimestampCursor {
  createdAt: Date;
  id: string;
}

export function clampLimit(rawLimit: number | undefined, fallback = 20, max = 50): number {
  if (!Number.isFinite(rawLimit)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(rawLimit ?? fallback), 1), max);
}

export function encodeTimestampCursor(cursor: TimestampCursor): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeTimestampCursor(rawCursor: string | undefined): TimestampCursor | null {
  if (!rawCursor?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };

    if (!parsed.createdAt || !parsed.id) {
      return null;
    }

    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return {
      createdAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

export function buildCursorPageResult<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
): CursorPageResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];

  return {
    items,
    pageInfo: {
      limit,
      hasMore,
      nextCursor: lastItem ? encodeTimestampCursor(lastItem) : null,
    },
  };
}
