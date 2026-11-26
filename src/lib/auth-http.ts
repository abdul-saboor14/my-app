import "server-only";

import { isIP } from "node:net";
import { getCurrentUser } from "@/lib/auth";
import type { AccountRole } from "@/lib/account-paths";
import { hashIdentifier, readBody, validateOrigin } from "@/lib/auth-security";
import { getDatabase } from "@/lib/db";

export function reply(body: { error: string } | { message: string }, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function forbiddenOrigin(request: Request) {
  if (!validateOrigin(request)) return reply({ error: "Request origin is not allowed." }, 403);
}

export async function adminWriteDenied(request: Request) {
  const originError = forbiddenOrigin(request);
  if (originError) return originError;

  const user = await getCurrentUser("admin");
  if (!user) return reply({ error: "Please sign in as an administrator." }, 401);
}

export function unavailable() {
  return reply({ error: "This service is temporarily unavailable. Please try again later." }, 503);
}

export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

const limits = {
  login: { global: 240, ip: 30, subject: 8 },
  register: { global: 100, ip: 12, subject: 5 },
  recovery: { global: 120, ip: 15, subject: 4 },
  reset: { global: 120, ip: 20, subject: 6 },
  password: { global: 120, ip: 20, subject: 6 },
};

export async function rateLimited(request: Request, action: keyof typeof limits, subject: string, role: AccountRole = "user") {
  // Only enable a header that the ingress strips and overwrites.
  const header = process.env.AUTH_CLIENT_IP_HEADER;
  const ip = header ? request.headers.get(header)?.trim() : null;
  const limit = limits[action];
  const sql = getDatabase();
  const buckets: [string, number][] = [["global", limit.global]];
  if (ip && isIP(ip)) buckets.push([`ip:${ip}`, limit.ip]);
  buckets.push([`subject:${subject}`, limit.subject]);

  // Consume the shared budget first, bounding downstream bucket growth.
  const namespace = role === "admin" ? `admin:${action}` : action;
  for (const [scope, maximum] of buckets) {
    const key = hashIdentifier(`${namespace}:${scope}`);
    const rows = await sql`
      INSERT INTO auth_rate_limits (bucket_key, window_start, hits)
      VALUES (${key}, date_bin(INTERVAL '15 minutes', NOW(), TIMESTAMPTZ '2000-01-01 00:00:00+00'), 1)
      ON CONFLICT (bucket_key, window_start) DO UPDATE
      SET hits = auth_rate_limits.hits + 1
      WHERE auth_rate_limits.hits < ${maximum}
      RETURNING hits
    `;
    if (!rows.length) {
      return Response.json({ error: "Too many attempts. Please try again later." }, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "900" },
      });
    }
  }
}

export function post(handler: (request: Request, body: Record<string, unknown>) => Promise<Response>) {
  return async (request: Request) => {
    const originError = forbiddenOrigin(request);
    if (originError) return originError;

    const body = await readBody(request);
    if (!body) return reply({ error: "Send a valid JSON request." }, 400);
    try {
      return await handler(request, body);
    } catch {
      console.error("Authentication request failed.");
      return unavailable();
    }
  };
}
