
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { forbiddenOrigin } from "@/lib/auth-http";
import { getDatabase } from "@/lib/db";
import { getRestaurantSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderItem = {
  id: number;
  quantity: number;
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    value.length <= 18
  );
}

function validItems(value: unknown): value is OrderItem[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 20
  ) {
    return false;
  }

  const ids = new Set<number>();

  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      !Number.isSafeInteger(item.id) ||
      item.id <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20 ||
      ids.has(item.id)
    ) {
      return false;
    }

    ids.add(item.id);
  }

  return true;
}

export async function POST(request: Request) {
  const originError = forbiddenOrigin(request);
  if (originError) return originError;

  const customer = await getCurrentUser("user");

  if (!customer) {
    return NextResponse.json(
      { error: "Please sign in as a customer." },
      { status: 401 }
    );
  }

  let input: Record<string, unknown>;

  try {
    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new Error("Invalid body");
    }

    input = body as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid order request." },
      { status: 400 }
    );
  }

  const reservationId = input.reservationId;
  const items = input.items;
  const key = input.idempotencyKey;
  const notes = input.notes ?? "";

  if (
    !validId(reservationId) ||
    !validItems(items) ||
    typeof key !== "string" ||
    !uuidRegex.test(key) ||
    typeof notes !== "string" ||
    notes.length > 500
  ) {
    return NextResponse.json(
      { error: "Check your reservation and order items." },
      { status: 400 }
    );
  }

  try {
    const settings = await getRestaurantSettings();

    const tax = settings.tax_rate_percent;
    const service = settings.service_charge_percent;

    if (
      !Number.isFinite(tax) ||
      !Number.isFinite(service) ||
      tax < 0 ||
      service < 0 ||
      tax > 100 ||
      service > 100
    ) {
      throw new Error("Invalid restaurant pricing settings.");
    }

    const sql = getDatabase();

    // A single SQL statement inserts the order and
    // order items atomically. Prices come only from
    // the database, never from the browser.
    const rows = await sql`
      WITH requested AS (
        SELECT
          x.id,
          x.quantity
        FROM jsonb_to_recordset(
          ${JSON.stringify(items)}::jsonb
        ) AS x(id integer, quantity integer)
      ),
      selected_items AS (
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
      calculation AS (
        SELECT
          COUNT(*)::integer AS item_count,
          COALESCE(
            SUM(price * quantity),
            0
          )::numeric AS subtotal
        FROM selected_items
      ),
      amounts AS (
        SELECT
          subtotal,
          ROUND(
            subtotal * ${tax}::numeric / 100,
            2
          ) AS tax_amount,
          ROUND(
            subtotal * ${service}::numeric / 100,
            2
          ) AS service_amount
        FROM calculation
        WHERE item_count = ${items.length}
      ),
      eligible_reservation AS (
        SELECT r.id
        FROM reservations r
        WHERE r.id = ${reservationId}::bigint
          AND r.user_id = ${customer.id}::bigint
          AND r.status IN ('confirmed', 'seated')
          AND r.ends_at > NOW()
      ),
      new_order AS (
        INSERT INTO orders (
          user_id,
          reservation_id,
          order_type,
          status,
          subtotal,
          tax_amount,
          service_amount,
          total_amount,
          payment_status,
          idempotency_key,
          customer_notes
        )
        SELECT
          ${customer.id}::bigint,
          r.id,
          'dine_in',
          'pending',
          a.subtotal,
          a.tax_amount,
          a.service_amount,
          a.subtotal +
            a.tax_amount +
            a.service_amount,
          'unpaid',
          ${key}::uuid,
          ${notes}
        FROM eligible_reservation r
        CROSS JOIN amounts a
        ON CONFLICT (user_id, idempotency_key)
        DO NOTHING
        RETURNING
          id,
          subtotal,
          tax_amount,
          service_amount,
          total_amount,
          status
      ),
      saved_items AS (
        INSERT INTO order_items (
          order_id,
          menu_item_id,
          item_name,
          quantity,
          unit_price
        )
        SELECT
          o.id,
          s.id,
          s.name,
          s.quantity,
          s.price
        FROM new_order o
        CROSS JOIN selected_items s
        RETURNING id
      )
      SELECT
        o.id::text AS id,
        o.subtotal::text AS subtotal,
        o.tax_amount::text AS tax_amount,
        o.service_amount::text AS service_amount,
        o.total_amount::text AS total_amount,
        o.status,
        (SELECT COUNT(*) FROM saved_items)::integer
          AS item_count
      FROM new_order o
    `;

    if (!rows.length) {
      return NextResponse.json(
        {
          error:
            "The reservation or menu selection is no longer available, " +
            "or this order has already been submitted. " +
            "Refresh your order before trying again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: "Your order has been placed.",
        order: rows[0],
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Customer order creation failed:", error);

    const code =
      error &&
      typeof error === "object" &&
      "code" in error
        ? String(error.code)
        : "";

    if (
      code === "23505" ||
      code === "23503" ||
      code === "23514"
    ) {
      return NextResponse.json(
        {
          error:
            "Your order could not be saved because the data changed. " +
            "Refresh and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to place your order right now." },
      { status: 503 }
    );
  }
}
