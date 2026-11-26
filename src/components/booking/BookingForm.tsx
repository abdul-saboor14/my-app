
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  Users,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

type DiningTable = {
  id: number;
  tableNumber: string;
  capacity: number;
  location: string | null;
};

type Reservation = {
  id: string;
  tableNumber: string;
  location: string | null;
  startsAt: string;
  guests: number;
  status: string;
};

async function responseData(response: Response) {
  return (await response.json()) as {
    error?: string;
    message?: string;
    availableTables?: DiningTable[];
    reservation?: Reservation;
  };
}

export default function BookingForm() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [guests, setGuests] = useState(2);

  const [tables, setTables] = useState<DiningTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [searched, setSearched] = useState(false);

  const [error, setError] = useState("");
  const [confirmation, setConfirmation] =
    useState<Reservation | null>(null);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  function changeSearch() {
    setTables([]);
    setSelectedTable(null);
    setSearched(false);
    setError("");
  }

  async function checkAvailability(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSearched(false);
    setTables([]);
    setSelectedTable(null);

    try {
      const params = new URLSearchParams({
        date,
        time,
        guests: String(guests),
      });

      const response = await fetch(
        `/api/tables/availability?${params}`,
        { cache: "no-store" }
      );

      const data = await responseData(response);

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to check availability."
        );
      }

      setTables(data.availableTables ?? []);
      setSearched(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmBooking() {
    if (selectedTable === null || booking) return;

    setBooking(true);
    setError("");

    try {
      const response = await fetch(
        "/api/tables/reservations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date,
            time,
            guests,
            tableId: selectedTable,
            idempotencyKey: crypto.randomUUID(),
          }),
        }
      );

      const data = await responseData(response);

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to reserve the table."
        );
      }

      if (!data.reservation) {
        throw new Error("No booking confirmation received.");
      }

      setConfirmation(data.reservation);
      setTables([]);
      setSelectedTable(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete reservation."
      );
      setSearched(false);
      setTables([]);
      setSelectedTable(null);
    } finally {
      setBooking(false);
    }
  }

  if (confirmation) {
    return (
      <div
        style={{
          background: "#FFFCF7",
          border: "1px solid #E5DACE",
          padding: 35,
          borderRadius: 16,
          textAlign: "center",
        }}
      >
        <CheckCircle2
          size={58}
          color="#54775B"
          style={{ margin: "0 auto 20px" }}
        />

        <h2
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 34,
            marginBottom: 12,
          }}
        >
          Reservation Confirmed!
        </h2>

        <p>Your table at Savoria is reserved.</p>

        <div
          style={{
            background: "#F6F0E8",
            borderRadius: 12,
            padding: 24,
            margin: "25px 0",
            textAlign: "left",
            lineHeight: 2,
          }}
        >
          <p><strong>Booking ID:</strong> {confirmation.id}</p>
          <p><strong>Date:</strong> {date}</p>
          <p><strong>Time:</strong> {time} (Pakistan time)</p>
          <p><strong>Guests:</strong> {confirmation.guests}</p>
          <p><strong>Table:</strong> {confirmation.tableNumber}</p>
          <p><strong>Location:</strong> {confirmation.location ?? "Restaurant"}</p>
          <p><strong>Status:</strong> {confirmation.status}</p>
        </div>

        <Link
          href="/account"
          className="button button-primary"
        >
          Back to Dashboard <ArrowRight size={17} />
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#FFFCF7",
        border: "1px solid #E5DACE",
        borderRadius: 16,
        padding: "clamp(20px, 5vw, 38px)",
      }}
    >
      <form onSubmit={checkAvailability}>
        <h2
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 29,
            marginBottom: 26,
          }}
        >
          Find Your Perfect Table
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 20,
          }}
        >
          <div className="field">
            <label htmlFor="booking-date">
              <CalendarDays size={16} /> Reservation Date
            </label>

            <input
              id="booking-date"
              type="date"
              min={today}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                changeSearch();
              }}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="booking-time">
              <Clock3 size={16} /> Dining Time
            </label>

            <input
              id="booking-time"
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
                changeSearch();
              }}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="booking-guests">
              <Users size={16} /> Number of Guests
            </label>

            <select
              id="booking-guests"
              value={guests}
              onChange={(event) => {
                setGuests(Number(event.target.value));
                changeSearch();
              }}
              style={{
                width: "100%",
                padding: 15,
                border: "1px solid #E2D9CC",
                borderRadius: 5,
                background: "#FFFEFA",
                color: "#291E18",
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1)
                .map((number) => (
                  <option key={number} value={number}>
                    {number} {number === 1 ? "Guest" : "Guests"}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="button button-primary"
          disabled={loading || booking}
          style={{ marginTop: 10 }}
        >
          {loading ? (
            <>
              <RefreshCw size={17} />
              Checking...
            </>
          ) : (
            <>
              Check Availability
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          style={{
            color: "#B52821",
            marginTop: 22,
            lineHeight: 1.7,
          }}
        >
          {error}
        </p>
      )}

      {searched && (
        <div style={{ marginTop: 42 }}>
          <h2
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 28,
              marginBottom: 18,
            }}
          >
            Available Tables
          </h2>

          {tables.length === 0 ? (
            <p style={{ color: "#81776E" }}>
              No tables are available for your selected time.
              Please try another date or time.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 15,
              }}
            >
              {tables.map((table) => {
                const selected = selectedTable === table.id;

                return (
                  <button
                    type="button"
                    key={table.id}
                    onClick={() => setSelectedTable(table.id)}
                    aria-pressed={selected}
                    disabled={booking}
                    style={{
                      textAlign: "left",
                      padding: 22,
                      borderRadius: 12,
                      cursor: "pointer",
                      background: selected
                        ? "#F3E6DC"
                        : "#FFFCF7",
                      border: selected
                        ? "2px solid #B96547"
                        : "1px solid #E5DACE",
                      color: "#291E18",
                    }}
                  >
                    <strong style={{ fontSize: 21 }}>
                      Table {table.tableNumber}
                    </strong>

                    <p style={{ marginTop: 10 }}>
                      {table.capacity} Seats
                    </p>

                    <p
                      style={{
                        fontSize: 12,
                        color: "#81776E",
                        marginTop: 6,
                      }}
                    >
                      {table.location ?? "Indoor Dining"}
                    </p>

                    {selected && (
                      <p
                        style={{
                          color: "#B96547",
                          marginTop: 12,
                          fontWeight: 700,
                        }}
                      >
                        Selected ✓
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedTable !== null && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => void confirmBooking()}
              disabled={booking}
              style={{ marginTop: 28 }}
            >
              {booking
                ? "Confirming..."
                : "Confirm Reservation"}
              <CheckCircle2 size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
