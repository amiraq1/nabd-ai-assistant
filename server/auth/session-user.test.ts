import test from "node:test";
import assert from "node:assert/strict";
import { __sessionUserInternals, resolveSessionUserId, USER_COOKIE_NAME } from "./session-user.js";
import type { Request, Response } from "express";

test("parses cookie header into key/value map", () => {
  const parsed = __sessionUserInternals.parseCookieHeader(
    "foo=bar; nabd_uid=user-123; theme=dark",
  );
  assert.equal(parsed.foo, "bar");
  assert.equal(parsed.nabd_uid, "user-123");
  assert.equal(parsed.theme, "dark");
});

test("reuses valid user cookie value", () => {
  const req = {
    headers: { cookie: `${USER_COOKIE_NAME}=guest_abc12345` },
  } as unknown as Request;
  const appended: Array<{ name: string; value: string }> = [];
  const res = {
    append: (name: string, value: string) => {
      appended.push({ name, value });
    },
  } as unknown as Response;

  const userId = resolveSessionUserId(req, res);
  assert.equal(userId, "guest_abc12345");
  assert.equal(appended.length, 0);
});

test("generates and sets cookie when missing", () => {
  const req = {
    headers: {},
  } as unknown as Request;
  const appended: Array<{ name: string; value: string }> = [];
  const res = {
    append: (name: string, value: string) => {
      appended.push({ name, value });
    },
  } as unknown as Response;

  const userId = resolveSessionUserId(req, res);
  assert.match(userId, /^[A-Za-z0-9_-]{8,80}$/);
  assert.equal(appended.length, 1);
  assert.equal(appended[0]?.name, "Set-Cookie");
  assert.match(appended[0]?.value ?? "", new RegExp(`^${USER_COOKIE_NAME}=`));
});
