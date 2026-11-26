
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { getRestaurantSettings } from "@/lib/settings";

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

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const date = params.get("date") ?? "";
  const time = params.get("time") ?? "";
  const guests = Number(params.get("guests"));

  if (!validDate(date) || !validTime(time)) {
    return NextResponse.json(
      { error: "Enter a valid date and time." },
      { status: 400 }
    );
  }

  if (
    !params.has("guests") ||
    !Number.isSafeInteger(guests) ||
    guests < 1
  ) {
    return NextResponse.json(
      { error: "Enter a valid number of guests." },
      { status: 400 }
    );
  }

  try {
    const settings = await getRestaurantSettings();

    if (!settings.allow_online_booking) {
      return NextResponse.json(
        { error: "Online booking is currently disabled." },
        { status: 403 }
      );
    }

    if (guests > settings.booking_max_party_size) {
      return NextResponse.json(
        {
          error: `Maximum party size is ${settings.booking_max_party_size}.`,
        },
        { status: 400 }
      );
    }

    const dayNumber = new Date(
      `${date}T00:00:00Z`
    ).getUTCDay();

    const dayName = days[dayNumber];

    const hours = settings.opening_hours[dayName] as
      | { open?: unknown; close?: unknown }
      | undefined;

    const open = hours?.open;
    const close = hours?.close;

    if (
      typeof open !== "string" ||
      typeof close !== "string" ||
      !validTime(open) ||
      !validTime(close) ||
      open >= close
    ) {
      return NextResponse.json({
        availableTables: [],
        message: "Restaurant is closed or hours are unavailable.",
      });
    }

    if (time < open || time >= close) {
      return NextResponse.json({
        availableTables: [],
        message: "Selected time is outside opening hours.",
      });
    }

    const timezone = settings.restaurant_timezone;
    const duration = settings.booking_duration_minutes;
    const advance = settings.booking_advance_days;

    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      !Number.isInteger(advance) ||
      advance < 0
    ) {
      throw new Error("Invalid booking configuration.");
    }

    const sql = getDatabase();

    const rows = await sql`
      WITH slot AS (
        SELECT
          (
            ${date}::date + ${time}::time
          ) AT TIME ZONE ${timezone} AS starts_at,

          (
            ${date}::date + ${time}::time
            + (${duration}::integer * INTERVAL '1 minute')
          ) AT TIME ZONE ${timezone} AS ends_at,

          (
            ${date}::date + ${close}::time
          ) AT TIME ZONE ${timezone} AS closes_at
      )
      SELECT
        t.id,
        t.table_number,
        t.capacity,
        t.location
      FROM dining_tables t
      CROSS JOIN slot s
      WHERE
        t.is_active = TRUE
        AND t.capacity >= ${guests}

        AND s.starts_at > NOW()
        AND s.ends_at <= s.closes_at

        AND ${date}::date BETWEEN
          (NOW() AT TIME ZONE ${timezone})::date
          AND
          (
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
      ORDER BY
        t.capacity ASC,
        t.table_number ASC
    `;

    return NextResponse.json(
      {
        availableTables: rows.map((row) => ({
          id: Number(row.id),
          tableNumber: row.table_number,
          capacity: row.capacity,
          location: row.location,
        })),
        date,
        time,
        guests,
        durationMinutes: duration,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Table availability error:", error);

    return NextResponse.json(
      {
        error: "Unable to check table availability.",
      },
      { status: 503 }
    );
  }
}
