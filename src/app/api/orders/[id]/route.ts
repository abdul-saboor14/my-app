
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { forbiddenOrigin } from "@/lib/auth-http";
import { getDatabase } from "@/lib/db";
import { getRestaurantSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ItemInput = {
  id: number;
  quantity: number;
};

function validItems(value: unknown): value is ItemInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    return false;
  }

  const seen = new Set<number>();

  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      !Number.isSafeInteger(item.id) ||
      item.id < 1 ||
      item.id > 2147483647 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20 ||
      seen.has(item.id)
    ) {
      return false;
    }

    seen.add(item.id);
  }

  return true;
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  const originError = forbiddenOrigin(request);
  if (originError) return originError;

  const customer = await getCurrentUser("user");

  if (!customer) {
    return NextResponse.json(
      { error: "Please sign in as a customer." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  if (!/^[1-9]\d{0,17}$/.test(id)) {
    return NextResponse.json(
      { error: "Invalid order ID." },
      { status: 400 }
    );
  }

  let input: Record<string, unknown>;

  try {
    const raw = await request.text();

    if (raw.length > 8192) {
      return NextResponse.json(
        { error: "Order request is too large." },
        { status: 413 }
      );
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("Invalid body");
    }

    input = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid order request." },
      { status: 400 }
    );
  }

  const items = input.items;
  const notes = input.notes;

  if (
    !validItems(items) ||
    typeof notes !== "string" ||
    notes.length > 500
  ) {
    return NextResponse.json(
      {
        error:
          "Select 1–20 different dishes, valid quantities, and instructions under 500 characters.",
      },
      { status: 400 }
    );
  }

  try {
    const settings = await getRestaurantSettings();
    const taxRate = settings.tax_rate_percent;
    const serviceRate = settings.service_charge_percent;

    if (
      !Number.isFinite(taxRate) ||
      !Number.isFinite(serviceRate) ||
      taxRate < 0 ||
      taxRate > 100 ||
      serviceRate < 0 ||
      serviceRate > 100
    ) {
      throw new Error("Invalid pricing settings");
    }

    const sql = getDatabase();

    // The order UPDATE is the gate for all item changes.
    // PostgreSQL locks this row and rechecks its status.
    // Every item operation depends on that UPDATE.
    // The whole statement succeeds or fails atomically.
    const rows = await sql`
      WITH requested AS (
        SELECT x.id, x.quantity
        FROM jsonb_to_recordset(
          ${JSON.stringify(items)}::jsonb
        ) AS x(id integer, quantity integer)
      ),
      priced AS (
        SELECT
          m.id,
          m.name,
          m.price,
          req.quantity
        FROM requested req
        JOIN menu_items m
          ON m.id = req.id
        WHERE m.is_available = TRUE
      ),
      calculated AS (
        SELECT
          COUNT(*)::integer AS item_count,
          COALESCE(SUM(price * quantity), 0)::numeric
            AS subtotal
        FROM priced
      ),
      amounts AS (
        SELECT
          subtotal,
          ROUND(
            subtotal * ${taxRate}::numeric / 100,
            2
          ) AS tax_amount,
          ROUND(
            subtotal * ${serviceRate}::numeric / 100,
            2
          ) AS service_amount
        FROM calculated
        WHERE item_count = ${items.length}
      ),
      changed AS (
        UPDATE orders o
        SET
          subtotal = a.subtotal,
          tax_amount = a.tax_amount,
          service_amount = a.service_amount,
          total_amount =
            a.subtotal + a.tax_amount + a.service_amount,
          customer_notes = ${notes}
        FROM amounts a
        WHERE o.id = ${id}::bigint
          AND o.user_id = ${customer.id}::bigint
          AND o.status = 'pending'
          AND o.payment_status = 'unpaid'
          AND clock_timestamp() <
            o.created_at + INTERVAL '5 minutes'
        RETURNING
          o.id,
          o.status,
          o.total_amount
      ),
      upserted AS (
        INSERT INTO order_items (
          order_id,
          menu_item_id,
          item_name,
          quantity,
          unit_price
        )
        SELECT
          c.id,
          p.id,
          p.name,
          p.quantity,
          p.price
        FROM changed c
        CROSS JOIN priced p
        ON CONFLICT (order_id, menu_item_id)
        DO UPDATE SET
          item_name = EXCLUDED.item_name,
          quantity = EXCLUDED.quantity,
          unit_price = EXCLUDED.unit_price
        RETURNING id
      ),
      removed AS (
        DELETE FROM order_items oi
        USING changed c
        WHERE oi.order_id = c.id
          AND NOT EXISTS (
            SELECT 1
            FROM requested req
            WHERE req.id = oi.menu_item_id
          )
        RETURNING oi.id
      )
      SELECT
        c.id::text AS id,
        c.status,
        c.total_amount::text AS total,
        (SELECT COUNT(*) FROM upserted)::integer
          AS saved_items,
        (SELECT COUNT(*) FROM removed)::integer
          AS removed_items
      FROM changed c
    `;

    if (!rows.length) {
      return NextResponse.json(
        {
          error:
            "Order editing is unavailable. The five-minute window may have expired, the kitchen may have accepted the order, or a selected dish is unavailable. Refresh My Orders.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: "Order updated successfully.",
        order: rows[0],
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Order editing failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to save your changes. Please refresh and try again.",
      },
      { status: 503 }
    );
  }
}
