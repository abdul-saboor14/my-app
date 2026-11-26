
import "server-only";

import argon2 from "argon2";
import {
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

export {
  emailRegex,
  normalizeUsername,
  normalizeEmail,
  usernameRegex,
  validatePassword,
} from "./auth-policy";

export const tokenRegex = /^[0-9a-f]{64}$/;

// PASSWORD HASHING

export function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

const dummyHash =
  "$argon2id$v=19$m=65536,t=3,p=1$Orn5kktebjR+JrC/n1y/Lg$CG47vc1GJ+jXuMw7cApH4RWUm4Gkt585S2B+lC2exO0";

export async function verifyPassword(
  hash: string | undefined,
  password: string
) {
  const supported = hash?.startsWith("$argon2id$");

  const matches = await argon2.verify(
    supported ? hash! : dummyHash,
    password
  );

  return Boolean(supported && matches);
}

// TOKEN UTILITIES

export function generateToken() {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIdentifier(identifier: string) {
  const pepper = process.env.AUTH_PEPPER;

  if (!pepper || pepper.length < 32) {
    throw new Error("AUTH_PEPPER is not configured");
  }

  return createHmac("sha256", pepper)
    .update(identifier)
    .digest("hex");
}

// APPLICATION URL VALIDATION

export function getAppUrl(
  value = process.env.APP_URL
): URL | null {
  try {
    const url = new URL(value ?? "");

    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    if (url.protocol === "https:") {
      return url;
    }

    if (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(
        url.hostname
      )
    ) {
      return url;
    }
  } catch {
    return null;
  }

  return null;
}

// TRUSTED WEBSITE ORIGINS

function getTrustedOrigins(): Set<string> {
  const trusted = new Set<string>();

  function add(value?: string) {
    if (!value) return;

    const url = getAppUrl(value.trim());

    if (url) {
      trusted.add(url.origin);
    }
  }

  // Existing application configuration
  add(process.env.APP_URL);

  // Your confirmed Savoria production domain
  add("https://dynamicwebsite-two.vercel.app");

  // Explicitly permitted extra origins
  const extra = process.env.AUTH_ALLOWED_ORIGINS;

  if (extra) {
    for (const origin of extra.split(",")) {
      add(origin);
    }
  }

  // Vercel's own deployment URL.
  // These values must come from Vercel server
  // environment variables, not request headers.
  if (process.env.VERCEL === "1") {
    const deployment = process.env.VERCEL_URL;

    const production =
      process.env.VERCEL_PROJECT_PRODUCTION_URL;

    if (deployment) {
      add(`https://${deployment}`);
    }

    if (production) {
      add(`https://${production}`);
    }
  }

  return trusted;
}

// CSRF ORIGIN PROTECTION

export function validateOrigin(request: Request) {
  const originHeader = request.headers.get("origin");

  if (!originHeader) {
    console.warn(
      "Origin check failed: Origin header missing."
    );
    return false;
  }

  let origin: string;

  try {
    const parsed = new URL(originHeader);

    if (
      parsed.origin !== originHeader ||
      parsed.username ||
      parsed.password ||
      parsed.protocol !== "https:" &&
        !(
          parsed.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"]
            .includes(parsed.hostname)
        )
    ) {
      return false;
    }

    origin = parsed.origin;
  } catch {
    return false;
  }

  const trusted = getTrustedOrigins();

  if (trusted.has(origin)) {
    return true;
  }

  // Diagnostic logging without passwords,
  // session cookies, or authorization tokens.
  console.warn("Origin check failed:", {
    receivedOrigin: origin,
    allowedOrigins: [...trusted],
  });

  return false;
}

// REQUEST VALIDATION UTILITIES

export function readString(
  body: Record<string, unknown>,
  key: string
) {
  const value = body[key];

  return typeof value === "string" ? value : "";
}

export async function readBody(request: Request) {
  if (
    request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim() !== "application/json"
  ) {
    return null;
  }

  const reader = request.body?.getReader();

  if (!reader) return null;

  try {
    const decoder = new TextDecoder("utf-8", {
      fatal: true,
    });

    let size = 0;
    let json = "";

    for (;;) {
      const { value, done } = await reader.read();

      if (done) break;

      size += value.byteLength;

      if (size > 8192) {
        await reader.cancel();
        return null;
      }

      json += decoder.decode(value, {
        stream: true,
      });
    }

    const value: unknown = JSON.parse(
      json + decoder.decode()
    );

    return value &&
      typeof value === "object" &&
      !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
