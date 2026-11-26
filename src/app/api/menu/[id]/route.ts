import { adminWriteDenied, unavailable } from "@/lib/auth-http";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

// DELETE: Remove a menu item from NeonDB
export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const denied = await adminWriteDenied(request);
    if (denied) return denied;
  } catch {
    return unavailable();
  }

  const { id } = await context.params;

  // Validate the provided ID
  if (!/^[1-9]\d*$/.test(id)) {
    return NextResponse.json(
      { error: "Invalid menu item ID." },
      { status: 400 }
    );
  }

  const itemId = Number(id);

  if (
    !Number.isSafeInteger(itemId) ||
    itemId > 2147483647
  ) {
    return NextResponse.json(
      { error: "Invalid menu item ID." },
      { status: 400 }
    );
  }

  try {
    const sql = getDatabase();

    const rows = await sql`
      DELETE FROM menu_items
      WHERE id = ${itemId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Menu item not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        deletedId: itemId,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    console.error("DELETE failed.");

    return NextResponse.json(
      {
        error:
          "Unable to delete the menu item. Please try again.",
      },
      { status: 503 }
    );
  }
}