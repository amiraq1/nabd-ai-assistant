import type { Request, Response } from "express";
import { randomUUID } from "crypto";

export const USER_COOKIE_NAME = "nabd_uid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, entry) => {
      const separator = entry.indexOf("=");
      if (separator <= 0) return acc;
      const key = entry.slice(0, separator).trim();
      const value = entry.slice(separator + 1).trim();
      if (!key || !value) return acc;
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function buildCookieValue(userId: string, secure: boolean): string {
  const parts = [
    `${USER_COOKIE_NAME}=${encodeURIComponent(userId)}`,
    "Path=/",
    `Max-Age=${ONE_YEAR_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function isLikelyUserId(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{8,80}$/.test(value));
}

export function resolveSessionUserId(req: Request, res: Response): string {
  const cookies = parseCookieHeader(req.headers.cookie);
  const existing = cookies[USER_COOKIE_NAME];

  if (isLikelyUserId(existing)) {
    return existing;
  }

  const userId = randomUUID();
  const secureCookie = process.env.NODE_ENV === "production";
  const cookie = buildCookieValue(userId, secureCookie);
  res.append("Set-Cookie", cookie);

  return userId;
}

export const __sessionUserInternals = {
  parseCookieHeader,
  buildCookieValue,
  isLikelyUserId,
};
