
import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  Users,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Plus,
  ClipboardList,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { AccountHeader } from "@/components/AuthLayout";

export const dynamic = "force-dynamic";

type Reservation = {
  id: string;
  table_number: string;
  location: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
  party_size: number;
  status: string;
  created_at: string | Date;
};

const statusColors: Record<
  string,
  { background: string; color: string }
> = {
  confirmed: {
    background: "#E6F0E4",
    color: "#39734A",
  },
  pending: {
    background: "#FFF1D8",
    color: "#956414",
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

export default async function CustomerReservationsPage() {
  const customer = await requireUser();

  const sql = getDatabase();

  const rows = await sql`
    SELECT
      r.id::text AS id,
      t.table_number,
      t.location,
      r.starts_at,
      r.ends_at,
      r.party_size,
      r.status,
      r.created_at
    FROM reservations r
    JOIN dining_tables t
      ON t.id = r.dining_table_id
    WHERE r.user_id = ${customer.id}
    ORDER BY r.starts_at DESC
  `;

  const reservations = rows as Reservation[];

  const upcoming = reservations.filter(
    (r) =>
      new Date(r.starts_at).getTime() > Date.now() &&
      ["pending", "confirmed"].includes(r.status)
  );

  return (
    <>
      <AccountHeader />

      <main
        style={{
          minHeight: "100vh",
          background: "#F6F0E8",
          padding: "65px 20px 100px",
        }}
      >
        <div
          style={{
            maxWidth: 1050,
            margin: "0 auto",
          }}
        >
          <Link
            href="/account"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "#B96547",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </Link>

          <p
            style={{
              marginTop: 42,
              fontSize: 12,
              letterSpacing: 3,
              color: "#B96547",
              fontWeight: 700,
            }}
          >
            SAVORIA CUSTOMER PORTAL
          </p>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(38px, 6vw, 60px)",
              color: "#291E18",
              margin: "16px 0",
            }}
          >
            My Reservations
          </h1>

          <p
            style={{
              color: "#81776E",
              lineHeight: 1.9,
              marginBottom: 35,
            }}
          >
            View your dining reservations, assigned tables,
            booking dates, and confirmation details.
          </p>

          {/* Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 38,
            }}
          >
            <div style={summaryCard}>
              <ClipboardList color="#B96547" size={25} />
              <h2 style={summaryNumber}>
                {reservations.length}
              </h2>
              <p>Total Reservations</p>
            </div>

            <div style={summaryCard}>
              <CalendarDays color="#B96547" size={25} />
              <h2 style={summaryNumber}>
                {upcoming.length}
              </h2>
              <p>Upcoming Reservations</p>
            </div>
          </div>

          {reservations.length === 0 ? (
            <div
              style={{
                background: "#FFFCF7",
                padding: "65px 25px",
                borderRadius: 16,
                textAlign: "center",
                border: "1px solid #E5DACE",
              }}
            >
              <CalendarDays
                size={52}
                color="#B96547"
                style={{ margin: "0 auto 20px" }}
              />

              <h2
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 30,
                  marginBottom: 15,
                }}
              >
                No Reservations Yet
              </h2>

              <p
                style={{
                  color: "#81776E",
                  marginBottom: 25,
                }}
              >
                Your Savoria dining journey starts
                with a table reservation.
              </p>

              <Link
                href="/book-table"
                className="button button-primary"
              >
                <Plus size={17} />
                Book Your First Table
              </Link>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 15,
                  flexWrap: "wrap",
                  marginBottom: 22,
                }}
              >
                <h2
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 29,
                  }}
                >
                  Booking History
                </h2>

                <Link
                  href="/book-table"
                  className="button button-primary"
                >
                  <Plus size={17} />
                  New Reservation
                </Link>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 20,
                }}
              >
                {reservations.map((reservation) => {
                  const badge =
                    statusColors[reservation.status] ??
                    {
                      background: "#E9E5DF",
                      color: "#51463E",
                    };

                  return (
                    <article
                      key={reservation.id}
                      style={{
                        background: "#FFFCF7",
                        border: "1px solid #E5DACE",
                        borderRadius: 15,
                        padding:
                          "clamp(20px, 4vw, 32px)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 15,
                          flexWrap: "wrap",
                          marginBottom: 24,
                        }}
                      >
                        <div>
                          <p
                            style={{
                              color: "#B96547",
                              fontSize: 11,
                              letterSpacing: 2,
                              fontWeight: 700,
                              marginBottom: 9,
                            }}
                          >
                            RESERVATION
                          </p>

                          <h3
                            style={{
                              fontFamily: "Georgia, serif",
                              fontSize: 27,
                              color: "#291E18",
                            }}
                          >
                            Table {reservation.table_number}
                          </h3>
                        </div>

                        <span
                          style={{
                            background: badge.background,
                            color: badge.color,
                            padding: "8px 16px",
                            borderRadius: 30,
                            fontSize: 12,
                            fontWeight: 700,
                            height: "fit-content",
                            textTransform: "capitalize",
                          }}
                        >
                          {reservation.status.replace("_", " ")}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 25,
                        }}
                      >
                        <Detail
                          icon={<CalendarDays size={20} />}
                          label="Date"
                          value={formatDate(reservation.starts_at)}
                        />

                        <Detail
                          icon={<Clock3 size={20} />}
                          label="Time"
                          value={`${formatTime(reservation.starts_at)} – ${formatTime(reservation.ends_at)}`}
                        />

                        <Detail
                          icon={<Users size={20} />}
                          label="Guests"
                          value={`${reservation.party_size} guests`}
                        />

                        <Detail
                          icon={<MapPin size={20} />}
                          label="Location"
                          value={
                            reservation.location ??
                            "Restaurant Dining"
                          }
                        />
                      </div>

                      <div
                        style={{
                          marginTop: 28,
                          paddingTop: 20,
                          borderTop: "1px solid #E8DFD4",
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          flexWrap: "wrap",
                          color: "#81776E",
                          fontSize: 12,
                        }}
                      >
                        <CheckCircle2
                          size={17}
                          color="#54775B"
                        />

                        <span>
                          Booking Reference:{" "}
                          <strong style={{ color: "#291E18" }}>
                            #{reservation.id}
                          </strong>
                        </span>

                        <span>
                          · Booked on{" "}
                          {formatDate(reservation.created_at)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
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
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span style={{ color: "#B96547" }}>
        {icon}
      </span>

      <div>
        <p
          style={{
            fontSize: 11,
            color: "#81776E",
            marginBottom: 7,
          }}
        >
          {label}
        </p>

        <p
          style={{
            fontWeight: 700,
            color: "#291E18",
            lineHeight: 1.5,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
