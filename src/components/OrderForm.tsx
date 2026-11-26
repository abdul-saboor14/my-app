
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Minus,
  Plus,
  ShoppingBag,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

type MenuItem = {
  id: number;
  name: string;
  description: string;
  price: string;
};

type Reservation = {
  id: string;
  tableNumber: string;
  startsAt: string;
};

type OrderResult = {
  id: string;
  total_amount: string;
  status: string;
};

type Props = {
  menu: MenuItem[];
  reservations: Reservation[];
  taxRate: number;
  serviceRate: number;
  currency: string;
};

export default function OrderForm({
  menu,
  reservations,
  taxRate,
  serviceRate,
  currency,
}: Props) {
  const [reservationId, setReservationId] = useState(
    reservations[0]?.id ?? ""
  );

  const [cart, setCart] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<OrderResult | null>(null);

  // Keep the same key on an uncertain retry to
  // prevent accidental duplicate orders.
  const submissionKey = useRef<string | null>(null);

  const entries = menu.filter((item) => (cart[item.id] ?? 0) > 0);

  const subtotal = entries.reduce(
    (sum, item) =>
      sum + Number(item.price) * cart[item.id],
    0
  );

  const tax = Math.round(subtotal * taxRate) / 100;
  const service = Math.round(subtotal * serviceRate) / 100;
  const total = subtotal + tax + service;

  const money = (value: number) =>
    `${currency} ${value.toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  function changeQuantity(id: number, change: number) {
    submissionKey.current = null;
    setError("");

    setCart((previous) => {
      const next = { ...previous };
      const quantity = Math.min(
        20,
        Math.max(0, (next[id] ?? 0) + change)
      );

      if (quantity === 0) {
        delete next[id];
      } else {
        next[id] = quantity;
      }

      return next;
    });
  }

  async function placeOrder() {
    if (
      loading ||
      !reservationId ||
      entries.length === 0
    ) {
      return;
    }

    setLoading(true);
    setError("");

    if (!submissionKey.current) {
      submissionKey.current = crypto.randomUUID();
    }

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationId,
          items: entries.map((item) => ({
            id: item.id,
            quantity: cart[item.id],
          })),
          notes,
          idempotencyKey: submissionKey.current,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        order?: OrderResult;
      };

      if (!response.ok) {
        if (response.status === 409) {
          submissionKey.current = null;
        }
        throw new Error(
          data.error ?? "Unable to place your order."
        );
      }

      if (!data.order) {
        throw new Error("Order confirmation was not received.");
      }

      setPlaced(data.order);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to place your order."
      );
    } finally {
      setLoading(false);
    }
  }

  if (placed) {
    return (
      <div style={panel}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <CheckCircle2
            size={58}
            color="#54775B"
            style={{ margin: "0 auto 20px" }}
          />

          <h2 style={heading}>Order Placed!</h2>

          <p style={{ margin: "16px 0", color: "#81776E" }}>
            Your order has been sent to Savoria.
          </p>

          <div
            style={{
              background: "#F6F0E8",
              padding: 22,
              borderRadius: 10,
              lineHeight: 2,
              textAlign: "left",
              margin: "25px 0",
            }}
          >
            <p><strong>Order:</strong> #{placed.id}</p>
            <p><strong>Total:</strong> {money(Number(placed.total_amount))}</p>
            <p><strong>Status:</strong> {placed.status}</p>
            <p><strong>Payment:</strong> Not yet paid</p>
          </div>

          <Link href="/account" className="button button-primary">
            Return to Dashboard <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 25 }}>
      <section style={panel}>
        <h2 style={heading}>Your Reservation</h2>

        {reservations.length === 0 ? (
          <div>
            <p style={{ color: "#81776E", margin: "14px 0 20px" }}>
              You need a confirmed reservation before placing
              a dine-in order.
            </p>

            <Link href="/book-table" className="button button-primary">
              Book a Table <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <>
            <p style={{ color: "#81776E", margin: "12px 0 16px" }}>
              Choose the reservation for this order.
            </p>

            <label htmlFor="reservation" style={label}>
              Dining Reservation
            </label>

            <select
              id="reservation"
              value={reservationId}
              onChange={(event) => {
                setReservationId(event.target.value);
                submissionKey.current = null;
              }}
              style={input}
            >
              {reservations.map((r) => (
                <option value={r.id} key={r.id}>
                  Table {r.tableNumber} —{" "}
                  {new Date(r.startsAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Karachi",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </option>
              ))}
            </select>
          </>
        )}
      </section>

      <section style={panel}>
        <h2 style={heading}>Choose Your Dishes</h2>

        <p style={{ color: "#81776E", margin: "12px 0 26px" }}>
          Select your favourites from our menu.
        </p>

        {menu.length === 0 ? (
          <p>No dishes are currently available.</p>
        ) : (
          <div style={{ display: "grid", gap: 13 }}>
            {menu.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #E8DFD4",
                  borderRadius: 12,
                  padding: 19,
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 20,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: "1 1 190px" }}>
                  <h3
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 21,
                      marginBottom: 7,
                    }}
                  >
                    {item.name}
                  </h3>

                  <p
                    style={{
                      color: "#81776E",
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {item.description}
                  </p>

                  <strong
                    style={{
                      color: "#B96547",
                      display: "block",
                      marginTop: 9,
                    }}
                  >
                    {money(Number(item.price))}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Remove one ${item.name}`}
                    disabled={loading || !cart[item.id]}
                    onClick={() => changeQuantity(item.id, -1)}
                    style={quantityButton}
                  >
                    <Minus size={16} />
                  </button>

                  <strong>{cart[item.id] ?? 0}</strong>

                  <button
                    type="button"
                    aria-label={`Add one ${item.name}`}
                    disabled={loading || cart[item.id] === 20}
                    onClick={() => changeQuantity(item.id, 1)}
                    style={quantityButton}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={panel}>
        <h2 style={heading}>
          <ShoppingBag
            size={25}
            style={{ display: "inline", marginRight: 10 }}
          />
          Your Order
        </h2>

        {entries.length === 0 ? (
          <p style={{ color: "#81776E", marginTop: 20 }}>
            Your cart is empty. Add dishes from the menu above.
          </p>
        ) : (
          <div style={{ marginTop: 24 }}>
            {entries.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 20,
                  padding: "12px 0",
                  borderBottom: "1px solid #E8DFD4",
                }}
              >
                <span>{cart[item.id]} × {item.name}</span>
                <strong>
                  {money(Number(item.price) * cart[item.id])}
                </strong>
              </div>
            ))}

            <div style={{ lineHeight: 2.3, marginTop: 20 }}>
              <div style={priceRow}>
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div style={priceRow}>
                <span>Tax ({taxRate}%)</span>
                <span>{money(tax)}</span>
              </div>
              <div style={priceRow}>
                <span>Service ({serviceRate}%)</span>
                <span>{money(service)}</span>
              </div>
              <div
                style={{
                  ...priceRow,
                  fontSize: 21,
                  fontWeight: 700,
                  borderTop: "1px solid #D8CABC",
                  paddingTop: 14,
                  marginTop: 10,
                }}
              >
                <span>Estimated Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <p
              style={{
                fontSize: 12,
                color: "#81776E",
                marginTop: 8,
              }}
            >
              Final charges are calculated on the server
              using current menu prices.
            </p>
          </div>
        )}

        <label
          htmlFor="order-notes"
          style={{ ...label, marginTop: 26 }}
        >
          Special Instructions (optional)
        </label>
        <textarea
          id="order-notes"
          maxLength={500}
          rows={3}
          value={notes}
          disabled={loading}
          onChange={(event) => {
            setNotes(event.target.value);
            submissionKey.current = null;
          }}
          placeholder="Any dietary preferences or requests?"
          style={{ ...input, resize: "vertical" }}
        />

        {error && (
          <p
            role="alert"
            style={{ color: "#A23C35", marginTop: 20 }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          className="button button-primary"
          disabled={
            loading ||
            !reservationId ||
            entries.length === 0
          }
          onClick={() => void placeOrder()}
          style={{ marginTop: 23 }}
        >
          {loading ? "Placing Order..." : "Place Order"}
          <ArrowRight size={17} />
        </button>
      </section>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "#FFFCF7",
  border: "1px solid #E5DACE",
  borderRadius: 15,
  padding: "clamp(20px, 4vw, 32px)",
  color: "#291E18",
};

const heading: React.CSSProperties = {
  fontFamily: "Georgia, serif",
  fontSize: 29,
};

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 14,
  border: "1px solid #D8CABC",
  borderRadius: 7,
  background: "#FFFFFF",
  color: "#291E18",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 9,
};

const quantityButton: React.CSSProperties = {
  width: 37,
  height: 37,
  display: "grid",
  placeItems: "center",
  border: "1px solid #D8CABC",
  borderRadius: 8,
  background: "#F6F0E8",
  color: "#291E18",
  cursor: "pointer",
};

const priceRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
};
