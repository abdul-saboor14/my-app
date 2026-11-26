
import { NextResponse } from "next/server";
import { adminWriteDenied, unavailable } from "@/lib/auth-http";
import { getDatabase } from "@/lib/db";
import { validateMenuInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

async function getItemId(context: Context) {
  const { id } = await context.params;

  if (!/^[1-9]\d*$/.test(id)) return null;

  const number = Number(id);

  if (
    !Number.isSafeInteger(number) ||
    number > 2147483647
  ) {
    return null;
  }

  return number;
}

// EDIT EXISTING MENU ITEM
export async function PATCH(
  request: Request,
  context: Context
) {
  try {
    const denied = await adminWriteDenied(request);
    if (denied) return denied;
  } catch {
    return unavailable();
  }

  const id = await getItemId(context);

  if (id === null) {
    return NextResponse.json(
      { error: "Invalid menu item ID." },
      { status: 400 }
    );
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
      UPDATE menu_items
      SET
        name = ${name},
        price = ${price},
        description = ${description},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        name,
        price::double precision AS price,
        description
    `;

    if (!rows.length) {
      return NextResponse.json(
        { error: "Menu item not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { item: rows[0] },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
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

    console.error("PATCH /api/menu/[id] failed.");

    return NextResponse.json(
      { error: "Unable to update the menu item." },
      { status: 503 }
    );
  }
}

// DELETE EXISTING MENU ITEM
export async function DELETE(
  request: Request,
  context: Context
) {
  try {
    const denied = await adminWriteDenied(request);
    if (denied) return denied;
  } catch {
    return unavailable();
  }

  const id = await getItemId(context);

  if (id === null) {
    return NextResponse.json(
      { error: "Invalid menu item ID." },
      { status: 400 }
    );
  }

  try {
    const sql = getDatabase();

    const rows = await sql`
      DELETE FROM menu_items
      WHERE id = ${id}
      RETURNING id
    `;

    if (!rows.length) {
      return NextResponse.json(
        { error: "Menu item not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, deletedId: id },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to delete the menu item." },
      { status: 503 }
    );
  }
}
