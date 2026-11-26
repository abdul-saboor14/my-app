
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRestaurantSettings } from "@/lib/settings";
import { forbiddenOrigin } from "@/lib/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const days = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function positiveId(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

export async function POST(request: NextRequest) {
  // Reject requests from untrusted origins.
  const originError = forbiddenOrigin(request);

  if (originError) {
    return originError;
  }

  // Require a customer session.
  const customer = await getCurrentUser("user");

  if (!customer) {
    return NextResponse.json(
      {
        error: "Please sign in as a customer to book a table.",
      },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;

  try {
    const input: unknown = await request.json();

    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      throw new Error("Invalid request");
    }

    body = input as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid booking request." },
      { status: 400 }
    );
  }

  const date = body.date;
  const time = body.time;
  const guests = body.guests;
  const tableId = body.tableId;
  const idempotencyKey = body.idempotencyKey;

  if (
    typeof date !== "string" ||
    typeof time !== "string" ||
    !validDate(date) ||
    !validTime(time) ||
    typeof guests !== "number" ||
    !Number.isSafeInteger(guests) ||
    guests < 1 ||
    !positiveId(tableId) ||
    typeof idempotencyKey !== "string" ||
    !uuidPattern.test(idempotencyKey)
  ) {
    return NextResponse.json(
      {
        error:
          "Enter a valid date, time, guest count and table.",
      },
      { status: 400 }
    );
  }

  try {
    const settings = await getRestaurantSettings();

    if (!settings.allow_online_booking) {
      return NextResponse.json(
        { error: "Online reservations are disabled." },
        { status: 403 }
      );
    }

    if (guests > settings.booking_max_party_size) {
      return NextResponse.json(
        {
          error:
            `Reservations support up to ` +
            `${settings.booking_max_party_size} guests.`,
        },
        { status: 400 }
      );
    }

    const weekday = days[
      new Date(`${date}T00:00:00Z`).getUTCDay()
    ];

    const configuredHours =
      settings.opening_hours[weekday];

    if (
      !configuredHours ||
      typeof configuredHours !== "object" ||
      Array.isArray(configuredHours)
    ) {
      return NextResponse.json(
        { error: "The restaurant is closed on this day." },
        { status: 400 }
      );
    }

    const hours = configuredHours as Record<string, unknown>;

    if (
      typeof hours.open !== "string" ||
      typeof hours.close !== "string" ||
      !validTime(hours.open) ||
      !validTime(hours.close) ||
      hours.open >= hours.close
    ) {
      return NextResponse.json(
        { error: "Booking hours are not configured." },
        { status: 400 }
      );
    }

    if (time < hours.open || time >= hours.close) {
      return NextResponse.json(
        {
          error: "Please select a time during opening hours.",
        },
        { status: 400 }
      );
    }

    const duration = settings.booking_duration_minutes;
    const advance = settings.booking_advance_days;
    const timezone = settings.restaurant_timezone;

    if (
      !Number.isSafeInteger(duration) ||
      duration <= 0 ||
      !Number.isSafeInteger(advance) ||
      advance < 0
    ) {
      throw new Error("Invalid booking settings.");
    }

    const sql = getDatabase();

    // This statement checks the table, opening hours,
    // booking period, and availability before inserting.
    //
    // PostgreSQL's no_overlapping_reservations
    // constraint protects against concurrent bookings.
    const rows = await sql`
      WITH slot AS (
        SELECT
          (
            (${date}::date + ${time}::time)
            AT TIME ZONE ${timezone}
          ) AS starts_at,

          (
            (
              ${date}::date + ${time}::time
              + (${duration}::integer * INTERVAL '1 minute')
            )
            AT TIME ZONE ${timezone}
          ) AS ends_at,

          (
            (${date}::date + ${hours.close}::time)
            AT TIME ZONE ${timezone}
          ) AS closes_at
      ),
      inserted AS (
        INSERT INTO reservations (
          user_id,
          dining_table_id,
          starts_at,
          ends_at,
          party_size,
          status,
          idempotency_key
        )
        SELECT
          ${customer.id}::bigint,
          t.id,
          s.starts_at,
          s.ends_at,
          ${guests},
          'confirmed',
          ${idempotencyKey}::uuid
        FROM dining_tables t
        CROSS JOIN slot s
        WHERE
          t.id = ${tableId}
          AND t.is_active = TRUE
          AND t.capacity >= ${guests}

          AND s.starts_at > NOW()
          AND s.ends_at <= s.closes_at

          AND ${date}::date BETWEEN
            (NOW() AT TIME ZONE ${timezone})::date
            AND (
              (NOW() AT TIME ZONE ${timezone})::date
              + ${advance}::integer
            )

          AND NOT EXISTS (
            SELECT 1
            FROM reservations r
            WHERE
              r.dining_table_id = t.id
              AND r.status IN (
                'pending',
                'confirmed',
                'seated'
              )
              AND r.starts_at < s.ends_at
              AND r.ends_at > s.starts_at
          )
        ON CONFLICT (user_id, idempotency_key)
        DO NOTHING
        RETURNING
          id,
          dining_table_id,
          starts_at,
          ends_at,
          party_size,
          status
      )
      SELECT
        i.id::text AS id,
        t.table_number,
        t.location,
        i.starts_at,
        i.ends_at,
        i.party_size,
        i.status
      FROM inserted i
      JOIN dining_tables t
        ON t.id = i.dining_table_id
    `;

    if (!rows.length) {
      return NextResponse.json(
        {
          error:
            "This table is no longer available. " +
            "Please check availability again.",
        },
        { status: 409 }
      );
    }

    const reservation = rows[0];

    return NextResponse.json(
      {
        message: "Your table has been reserved!",
        reservation: {
          id: reservation.id,
          tableNumber: reservation.table_number,
          location: reservation.location,
          startsAt: reservation.starts_at,
          endsAt: reservation.ends_at,
          guests: reservation.party_size,
          status: reservation.status,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error
        ? String(error.code)
        : "";

    // PostgreSQL exclusion constraint violation:
    // another customer booked an overlapping slot.
    if (code === "23P01" || code === "23505") {
      return NextResponse.json(
        {
          error:
            "This table has just been booked. " +
            "Please choose another available table.",
        },
        { status: 409 }
      );
    }

    console.error("Reservation creation failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to complete your reservation. " +
          "Please try again.",
      },
      { status: 503 }
    );
  }
}
