
import { NextResponse } from "next/server";
import { adminWriteDenied, unavailable } from "@/lib/auth-http";
import { getDatabase } from "@/lib/db";
import { validateMenuInput } from "@/lib/validation";
import type { MenuItem } from "@/types/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
};

export async function GET() {
  try {
    const sql = getDatabase();

    const rows = await sql`
      SELECT
        id,
        name,
        price::double precision AS price,
        description
      FROM menu_items
      ORDER BY id DESC
    `;

    return NextResponse.json(
      { items: rows as MenuItem[] },
      { headers }
    );
  } catch (error) {
    console.error("Menu GET error:", error);

    return NextResponse.json(
      { error: "Unable to load menu items." },
      { status: 503, headers }
    );
  }
}

export async function POST(request: Request) {
  try {
    const denied = await adminWriteDenied(request);
    if (denied) return denied;
  } catch {
    return unavailable();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request." },
      { status: 400 }
    );
  }

  const validation = validateMenuInput(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const { name, price, description } = validation.data;

  try {
    const sql = getDatabase();

    const rows = await sql`
      INSERT INTO menu_items (
        name,
        price,
        description
      )
      VALUES (
        ${name},
        ${price},
        ${description}
      )
      RETURNING
        id,
        name,
        price::double precision AS price,
        description
    `;

    return NextResponse.json(
      { item: rows[0] as MenuItem },
      { status: 201, headers }
    );
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

    if (code === "23505") {
      return NextResponse.json(
        { error: "A dish with this name already exists." },
        { status: 409 }
      );
    }

    console.error("Menu INSERT failed:", error);

    return NextResponse.json(
      { error: "Could not add the dish. Check server logs." },
      { status: 503 }
    );
  }
}
