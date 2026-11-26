import { adminWriteDenied, unavailable } from "@/lib/auth-http";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { validateMenuInput } from "@/lib/validation";
import type { MenuItem } from "@/types/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
};

// GET: Retrieve all menu items from NeonDB
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
      { status: 200, headers }
    );
  } catch {
    console.error("GET /api/menu failed.");

    return NextResponse.json(
      {
        error:
          "Unable to load the menu. Please check the database connection.",
      },
      { status: 503, headers }
    );
  }
}

// POST: Add a new menu item to NeonDB
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

  try {
    const sql = getDatabase();

    const { name, price, description } = validation.data;

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
  } catch {
    console.error("POST /api/menu failed.");

    return NextResponse.json(
      {
        error:
          "Could not add the dish. Please try again.",
      },
      { status: 503, headers }
    );
  }
}