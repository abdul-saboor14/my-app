
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  Users,
  MapPin,
  ArrowLeft,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";

import { AccountHeader } from "@/components/AuthLayout";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

type Status =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

type Reservation = {
  id: string;
  customer_name: string;
  customer_email: string;
  table_number: string;
  location: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
  party_size: number;
  status: Status;
  created_at: string | Date;
};

const transitions: Record<Status, Status[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

const statusStyles: Record<
  Status,
  { background: string; color: string }
> = {
  pending: {
    background: "#FFF1D8",
    color: "#956414",
  },
  confirmed: {
    background: "#E6F0E4",
    color: "#39734A",
  },
  seated: {
    background: "#E2EAF7",
    color: "#365D91",
  },
  completed: {
    background: "#E8E4F0",
    color: "#645579",
  },
  cancelled: {
    background: "#F8E3E1",
    color: "#A23C35",
  },
  no_show: {
    background: "#F8E3E1",
    color: "#A23C35",
  },
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

// Server action: admin-only status updates.
async function changeReservationStatus(
  formData: FormData
) {
  "use server";

  await requireAdmin();

  const id = formData.get("id");
  const current = formData.get("current");
  const next = formData.get("next");

  if (
    typeof id !== "string" ||
    !/^[1-9]\d*$/.test(id) ||
    typeof current !== "string" ||
    typeof next !== "string" ||
    !(current in transitions) ||
    !transitions[current as Status].includes(
      next as Status
    )
  ) {
    redirect("/admin/reservations?result=invalid");
  }

  const sql = getDatabase();

  const rows = await sql`
    UPDATE reservations
    SET
      status = ${next},
      updated_at = NOW()
    WHERE
      id = ${id}::bigint
      AND status = ${current}
    RETURNING id
  `;

  revalidatePath("/admin/reservations");
  revalidatePath("/account/reservations");

  redirect(
    rows.length
      ? "/admin/reservations?result=updated"
      : "/admin/reservations?result=unchanged"
  );
}

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdmin();

  const { result } = await searchParams;
  const sql = getDatabase();

  const rows = await sql`
    SELECT
      r.id::text AS id,
      u.full_name AS customer_name,
      u.email AS customer_email,
      t.table_number,
      t.location,
      r.starts_at,
      r.ends_at,
      r.party_size,
      r.status,
      r.created_at
    FROM reservations r
    JOIN users u ON u.id = r.user_id
    JOIN dining_tables t
      ON t.id = r.dining_table_id
    ORDER BY r.starts_at DESC
    LIMIT 100
  `;

  const reservations = rows as Reservation[];

  const active = reservations.filter(
    (r) =>
      r.status === "pending" ||
      r.status === "confirmed" ||
      r.status === "seated"
  ).length;

  return (
    <>
      <AccountHeader role="admin" signedIn />

      <main
        style={{
          minHeight: "100vh",
          background: "#F6F0E8",
          padding: "65px 20px 100px",
          color: "#291E18",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "#B96547",
              fontWeight: 700,
            }}
          >
            <ArrowLeft size={17} />
            Back to Admin Dashboard
          </Link>

          <p
            style={{
              color: "#B96547",
              fontSize: 12,
              letterSpacing: 3,
              fontWeight: 700,
              marginTop: 40,
            }}
          >
            SAVORIA ADMINISTRATION
          </p>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(36px, 6vw, 58px)",
              margin: "15px 0",
            }}
          >
            Manage Reservations
          </h1>

          <p
            style={{
              color: "#81776E",
              lineHeight: 1.8,
              marginBottom: 30,
            }}
          >
            Review customer bookings, assigned
            tables and reservation statuses.
          </p>

          {result && (
            <p
              role="status"
              style={{
                background: "#FFF9EC",
                padding: 16,
                borderRadius: 8,
                marginBottom: 25,
              }}
            >
              {result === "updated"
                ? "Reservation status updated successfully."
                : result === "unchanged"
                  ? "The booking has changed. Refresh and try again."
                  : "Invalid reservation update."}
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 35,
            }}
          >
            <div style={summaryCard}>
              <ClipboardList size={25} color="#B96547" />
              <h2 style={summaryNumber}>
                {reservations.length}
              </h2>
              <p>Recent Reservations</p>
            </div>

            <div style={summaryCard}>
              <CalendarDays size={25} color="#B96547" />
              <h2 style={summaryNumber}>{active}</h2>
              <p>Active Reservations</p>
            </div>
          </div>

          {reservations.length === 0 ? (
            <div
              style={{
                background: "#FFFCF7",
                padding: 55,
                borderRadius: 14,
                textAlign: "center",
                border: "1px solid #E5DACE",
              }}
            >
              <h2
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 28,
                }}
              >
                No Reservations Yet
              </h2>
              <p style={{ marginTop: 12 }}>
                Customer bookings will appear here.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 20,
              }}
            >
              {reservations.map((r) => {
                const badge = statusStyles[r.status];
                const allowed = transitions[r.status];

                return (
                  <article
                    key={r.id}
                    style={{
                      background: "#FFFCF7",
                      padding:
                        "clamp(20px, 4vw, 32px)",
                      border: "1px solid #E5DACE",
                      borderRadius: 15,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 15,
                        marginBottom: 22,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            color: "#B96547",
                            fontSize: 11,
                            letterSpacing: 2,
                            fontWeight: 700,
                          }}
                        >
                          BOOKING #{r.id}
                        </p>
                        <h2
                          style={{
                            fontFamily: "Georgia, serif",
                            fontSize: 27,
                            marginTop: 9,
                          }}
                        >
                          {r.customer_name}
                        </h2>
                        <p
                          style={{
                            fontSize: 13,
                            color: "#81776E",
                            marginTop: 6,
                          }}
                        >
                          {r.customer_email}
                        </p>
                      </div>

                      <span
                        style={{
                          background: badge.background,
                          color: badge.color,
                          borderRadius: 30,
                          padding: "8px 15px",
                          fontWeight: 700,
                          fontSize: 12,
                          height: "fit-content",
                          textTransform: "capitalize",
                        }}
                      >
                        {r.status.replace("_", " ")}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: 22,
                        paddingBottom: 24,
                      }}
                    >
                      <Detail
                        icon={<CalendarDays size={19} />}
                        label="Date"
                        value={formatDate(r.starts_at)}
                      />

                      <Detail
                        icon={<Clock3 size={19} />}
                        label="Time"
                        value={
                          `${formatTime(r.starts_at)} – ` +
                          `${formatTime(r.ends_at)}`
                        }
                      />

                      <Detail
                        icon={<Users size={19} />}
                        label="Guests"
                        value={`${r.party_size} guests`}
                      />

                      <Detail
                        icon={<MapPin size={19} />}
                        label="Assigned Table"
                        value={
                          `${r.table_number} — ` +
                          `${r.location ?? "Dining Area"}`
                        }
                      />
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid #E8DFD4",
                        paddingTop: 22,
                      }}
                    >
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          marginBottom: 14,
                        }}
                      >
                        Manage Booking Status
                      </p>

                      {allowed.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          {allowed.map((next) => (
                            <form
                              key={next}
                              action={changeReservationStatus}
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={r.id}
                              />
                              <input
                                type="hidden"
                                name="current"
                                value={r.status}
                              />
                              <input
                                type="hidden"
                                name="next"
                                value={next}
                              />

                              <button
                                type="submit"
                                className={
                                  next === "cancelled" ||
                                  next === "no_show"
                                    ? "button button-outline"
                                    : "button button-primary"
                                }
                                style={{
                                  fontSize: 11,
                                  padding: "12px 16px",
                                }}
                              >
                                {next === "confirmed"
                                  ? "Confirm"
                                  : next === "seated"
                                    ? "Mark Seated"
                                    : next === "completed"
                                      ? "Complete"
                                      : next === "no_show"
                                        ? "No Show"
                                        : "Cancel"}
                              </button>
                            </form>
                          ))}
                        </div>
                      ) : (
                        <p
                          style={{
                            color: "#81776E",
                            fontSize: 13,
                            display: "flex",
                            gap: 9,
                            alignItems: "center",
                          }}
                        >
                          <CheckCircle2
                            size={17}
                            color="#54775B"
                          />
                          This booking is finalised.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const summaryCard: React.CSSProperties = {
  background: "#FFFCF7",
  border: "1px solid #E5DACE",
  borderRadius: 14,
  padding: 25,
  color: "#81776E",
};

const summaryNumber: React.CSSProperties = {
  fontFamily: "Georgia, serif",
  fontSize: 35,
  color: "#291E18",
  marginTop: 14,
  marginBottom: 5,
};

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "#B96547" }}>
        {icon}
      </span>
      <div>
        <p
          style={{
            color: "#81776E",
            fontSize: 11,
            marginBottom: 7,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
