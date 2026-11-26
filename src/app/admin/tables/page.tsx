
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  Armchair,
  ArrowLeft,
  Plus,
  Save,
  Users,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { AccountHeader } from "@/components/AuthLayout";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

type DiningTable = {
  id: string;
  table_number: string;
  capacity: number;
  location: string | null;
  is_active: boolean;
  upcoming_bookings: number;
};

type PageProps = {
  searchParams: Promise<{ result?: string }>;
};

const cardStyle: React.CSSProperties = {
  background: "#FFFCF7",
  border: "1px solid #E5DACE",
  borderRadius: 15,
  padding: 25,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  border: "1px solid #D8CABC",
  borderRadius: 7,
  background: "#FFFFFF",
  color: "#291E18",
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
  color: "#443329",
};

function readText(
  data: FormData,
  name: string
): string {
  const value = data.get(name);
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validTableNumber(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9 _-]{0,29}$/.test(value);
}

function validCapacity(value: string) {
  const number = Number(value);

  return (
    /^\d+$/.test(value) &&
    Number.isSafeInteger(number) &&
    number >= 1 &&
    number <= 100
  );
}

function validId(value: string) {
  return /^[1-9]\d*$/.test(value);
}

function databaseErrorCode(error: unknown) {
  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error
  ) {
    return String(error.code);
  }
  return "";
}

// ADD TABLE

async function addTable(formData: FormData) {
  "use server";

  await requireAdmin();

  const tableNumber = readText(formData, "tableNumber");
  const capacity = readText(formData, "capacity");
  const location = readText(formData, "location");

  if (
    !validTableNumber(tableNumber) ||
    !validCapacity(capacity) ||
    location.length > 100
  ) {
    redirect("/admin/tables?result=invalid");
  }

  const sql = getDatabase();
  let result = "added";

  try {
    await sql`
      INSERT INTO dining_tables (
        table_number,
        capacity,
        location,
        is_active
      )
      VALUES (
        ${tableNumber},
        ${Number(capacity)},
        ${location || null},
        TRUE
      )
    `;
  } catch (error) {
    result =
      databaseErrorCode(error) === "23505"
        ? "duplicate"
        : "error";
  }

  revalidatePath("/admin/tables");

  redirect(`/admin/tables?result=${result}`);
}

// EDIT TABLE

async function updateTable(formData: FormData) {
  "use server";

  await requireAdmin();

  const id = readText(formData, "id");
  const tableNumber = readText(formData, "tableNumber");
  const capacity = readText(formData, "capacity");
  const location = readText(formData, "location");
  const active = formData.get("isActive") === "on";

  if (
    !validId(id) ||
    !validTableNumber(tableNumber) ||
    !validCapacity(capacity) ||
    location.length > 100
  ) {
    redirect("/admin/tables?result=invalid");
  }

  const sql = getDatabase();
  let result = "updated";

  try {
    // Prevent changes that would invalidate upcoming bookings.
    // The NOT EXISTS condition is checked by PostgreSQL
    // in the same statement as the update.
    const rows = await sql`
      UPDATE dining_tables AS t
      SET
        table_number = ${tableNumber},
        capacity = ${Number(capacity)},
        location = ${location || null},
        is_active = ${active},
        updated_at = NOW()
      WHERE
        t.id = ${id}::bigint
        AND NOT EXISTS (
          SELECT 1
          FROM reservations AS r
          WHERE
            r.dining_table_id = t.id
            AND r.status IN (
              'pending',
              'confirmed',
              'seated'
            )
            AND r.ends_at > NOW()
            AND (
              r.party_size > ${Number(capacity)}
              OR ${!active}
            )
        )
      RETURNING t.id
    `;

    if (rows.length === 0) {
      result = "blocked";
    }
  } catch (error) {
    result =
      databaseErrorCode(error) === "23505"
        ? "duplicate"
        : "error";
  }

  revalidatePath("/admin/tables");

  redirect(`/admin/tables?result=${result}`);
}

const notices: Record<string, string> = {
  added: "New dining table added successfully.",
  updated: "Dining table updated successfully.",
  duplicate:
    "That table number is already in use. Please choose another.",
  invalid:
    "Check the table number, capacity, and location.",
  blocked:
    "Table not updated. It may have upcoming reservations that require its current capacity or active status.",
  error:
    "The table could not be saved. Please check the database and try again.",
};

export default async function AdminTablesPage({
  searchParams,
}: PageProps) {
  await requireAdmin();

  const { result } = await searchParams;
  const sql = getDatabase();

  const rows = await sql`
    SELECT
      t.id::text AS id,
      t.table_number,
      t.capacity,
      t.location,
      t.is_active,
      (
        SELECT COUNT(*)::integer
        FROM reservations r
        WHERE
          r.dining_table_id = t.id
          AND r.status IN (
            'pending',
            'confirmed',
            'seated'
          )
          AND r.ends_at > NOW()
      ) AS upcoming_bookings
    FROM dining_tables t
    ORDER BY t.table_number ASC
  `;

  const tables = rows as DiningTable[];

  const activeTables = tables.filter(
    (table) => table.is_active
  ).length;

  const totalSeats = tables
    .filter((table) => table.is_active)
    .reduce(
      (total, table) => total + Number(table.capacity),
      0
    );

  return (
    <>
      <AccountHeader role="admin" signedIn />

      <main
        style={{
          minHeight: "100vh",
          background: "#F6F0E8",
          color: "#291E18",
          padding: "65px 20px 100px",
        }}
      >
        <div
          style={{
            maxWidth: 1150,
            margin: "0 auto",
          }}
        >
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              color: "#B96547",
              fontWeight: 700,
            }}
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </Link>

          <p
            style={{
              marginTop: 42,
              fontSize: 12,
              color: "#B96547",
              fontWeight: 700,
              letterSpacing: 2.5,
            }}
          >
            SAVORIA RESTAURANT MANAGEMENT
          </p>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(38px, 6vw, 58px)",
              margin: "15px 0",
            }}
          >
            Manage Dining Tables
          </h1>

          <p
            style={{
              color: "#81776E",
              lineHeight: 1.8,
              marginBottom: 35,
            }}
          >
            Manage table numbers, seating capacity,
            dining locations, and availability.
            Changes are saved directly to NeonDB.
          </p>

          {result && notices[result] && (
            <div
              role="status"
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                padding: 16,
                background:
                  result === "added" || result === "updated"
                    ? "#E6F0E4"
                    : "#FFF1D8",
                color:
                  result === "added" || result === "updated"
                    ? "#39734A"
                    : "#956414",
                borderRadius: 10,
                marginBottom: 30,
              }}
            >
              {result === "added" || result === "updated" ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
              {notices[result]}
            </div>
          )}

          {/* RESTAURANT SUMMARY */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 17,
              marginBottom: 40,
            }}
          >
            <SummaryCard
              title="Total Tables"
              value={tables.length}
              icon={<Armchair size={25} />}
            />

            <SummaryCard
              title="Active Tables"
              value={activeTables}
              icon={<CheckCircle2 size={25} />}
            />

            <SummaryCard
              title="Total Seating Capacity"
              value={totalSeats}
              icon={<Users size={25} />}
            />
          </div>

          {/* ADD NEW TABLE */}

          <section
            style={{
              ...cardStyle,
              marginBottom: 45,
            }}
          >
            <h2
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 29,
                marginBottom: 10,
              }}
            >
              Add a New Table
            </h2>

            <p
              style={{
                color: "#81776E",
                fontSize: 13,
                marginBottom: 25,
              }}
            >
              Create a new dining table for customer reservations.
            </p>

            <form action={addTable}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 20,
                  marginBottom: 23,
                }}
              >
                <div>
                  <label
                    htmlFor="new-number"
                    style={labelStyle}
                  >
                    Table Number
                  </label>
                  <input
                    id="new-number"
                    name="tableNumber"
                    placeholder="T11"
                    maxLength={30}
                    pattern="[A-Za-z0-9][A-Za-z0-9 _-]{0,29}"
                    title="Start with a letter or number. Use letters, numbers, spaces, hyphens, or underscores."
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-capacity"
                    style={labelStyle}
                  >
                    Seating Capacity
                  </label>
                  <input
                    id="new-capacity"
                    name="capacity"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={4}
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-location"
                    style={labelStyle}
                  >
                    Dining Location
                  </label>
                  <input
                    id="new-location"
                    name="location"
                    placeholder="Window Side, Garden..."
                    maxLength={100}
                    style={inputStyle}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="button button-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                }}
              >
                <Plus size={18} />
                Add Dining Table
              </button>
            </form>
          </section>

          {/* EXISTING TABLES */}

          <section>
            <h2
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 31,
                marginBottom: 10,
              }}
            >
              Existing Dining Tables
            </h2>

            <p
              style={{
                color: "#81776E",
                marginBottom: 25,
              }}
            >
              Edit a table and click Save Changes
              to update the database.
            </p>

            {tables.length === 0 ? (
              <div
                style={{
                  ...cardStyle,
                  textAlign: "center",
                  padding: 45,
                }}
              >
                <Armchair
                  size={45}
                  color="#B96547"
                  style={{
                    margin: "0 auto 18px",
                  }}
                />
                <h3>No Tables Added Yet</h3>
                <p style={{ marginTop: 10 }}>
                  Use the form above to create your first table.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(290px, 1fr))",
                  gap: 20,
                }}
              >
                {tables.map((table) => (
                  <article
                    key={table.id}
                    style={cardStyle}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 22,
                      }}
                    >
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 12,
                          background: "#F3E6DC",
                          color: "#B96547",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Armchair size={26} />
                      </div>

                      <span
                        style={{
                          padding: "7px 13px",
                          borderRadius: 30,
                          fontSize: 12,
                          fontWeight: 700,
                          background: table.is_active
                            ? "#E6F0E4"
                            : "#F8E3E1",
                          color: table.is_active
                            ? "#39734A"
                            : "#A23C35",
                        }}
                      >
                        {table.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <form action={updateTable}>
                      <input
                        type="hidden"
                        name="id"
                        value={table.id}
                      />

                      <div style={{ marginBottom: 16 }}>
                        <label
                          htmlFor={`number-${table.id}`}
                          style={labelStyle}
                        >
                          Table Number
                        </label>
                        <input
                          id={`number-${table.id}`}
                          name="tableNumber"
                          defaultValue={table.table_number}
                          maxLength={30}
                          pattern="[A-Za-z0-9][A-Za-z0-9 _-]{0,29}"
                          required
                          style={inputStyle}
                        />
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label
                          htmlFor={`capacity-${table.id}`}
                          style={labelStyle}
                        >
                          Seating Capacity
                        </label>
                        <input
                          id={`capacity-${table.id}`}
                          name="capacity"
                          type="number"
                          min={1}
                          max={100}
                          defaultValue={table.capacity}
                          required
                          style={inputStyle}
                        />
                      </div>

                      <div style={{ marginBottom: 19 }}>
                        <label
                          htmlFor={`location-${table.id}`}
                          style={labelStyle}
                        >
                          Dining Location
                        </label>
                        <input
                          id={`location-${table.id}`}
                          name="location"
                          defaultValue={table.location ?? ""}
                          maxLength={100}
                          style={inputStyle}
                        />
                      </div>

                      <div
                        style={{
                          background: "#F6F0E8",
                          borderRadius: 9,
                          padding: 15,
                          marginBottom: 19,
                        }}
                      >
                        <label
                          htmlFor={`active-${table.id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            id={`active-${table.id}`}
                            name="isActive"
                            type="checkbox"
                            defaultChecked={table.is_active}
                            style={{
                              width: 18,
                              height: 18,
                              accentColor: "#B96547",
                            }}
                          />
                          Available for Bookings
                        </label>

                        <p
                          style={{
                            fontSize: 12,
                            color: "#81776E",
                            marginTop: 10,
                          }}
                        >
                          {table.upcoming_bookings} active
                          upcoming reservation(s)
                        </p>
                      </div>

                      <button
                        type="submit"
                        className="button button-primary"
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 9,
                        }}
                      >
                        <Save size={17} />
                        Save Changes
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div
            style={{
              marginTop: 38,
              padding: 20,
              background: "#EEE2D5",
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.8,
            }}
          >
            <strong>Booking protection:</strong>{" "}
            A table with active upcoming bookings
            cannot be disabled or reduced below
            the number of guests already reserved.
            Inactive tables are excluded from
            new customer reservations.
          </div>
        </div>
      </main>
    </>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          color: "#B96547",
          marginBottom: 12,
        }}
      >
        {icon}
      </div>

      <p
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 36,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {value}
      </p>

      <p
        style={{
          color: "#81776E",
          fontSize: 13,
        }}
      >
        {title}
      </p>
    </div>
  );
}
