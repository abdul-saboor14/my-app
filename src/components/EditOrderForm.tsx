
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Pencil, Plus, Minus, Save, X } from "lucide-react";

type MenuItem = {
  id: number;
  name: string;
  price: string;
};

type ExistingItem = {
  id: number;
  quantity: number;
};

type Props = {
  orderId: string;
  createdAt: string;
  initialNotes: string;
  initialItems: ExistingItem[];
  menu: MenuItem[];
};

const fieldStyle: React.CSSProperties = {
  border: "1px solid #D8CABC",
  borderRadius: 7,
  padding: 12,
  width: "100%",
  color: "#291E18",
  background: "#FFFFFF",
};

export default function EditOrderForm({
  orderId,
  createdAt,
  initialNotes,
  initialItems,
  menu,
}: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState(initialNotes);

  const [quantities, setQuantities] = useState<
    Record<number, number>
  >(
    () =>
      Object.fromEntries(
        initialItems.map((item) => [
          item.id,
          item.quantity,
        ])
      )
  );

  const deadline =
    new Date(createdAt).getTime() + 5 * 60 * 1000;

  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function updateClock() {
      setRemaining(
        Math.max(
          0,
          Math.ceil((deadline - Date.now()) / 1000)
        )
      );
    }

    updateClock();

    const interval = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(interval);
  }, [deadline]);

  const selected = menu.filter(
    (item) => (quantities[item.id] ?? 0) > 0
  );

  const subtotal = selected.reduce(
    (sum, item) =>
      sum +
      Number(item.price) * quantities[item.id],
    0
  );

  function changeQuantity(id: number, amount: number) {
    setQuantities((current) => {
      const next = { ...current };

      const quantity = Math.max(
        0,
        Math.min(20, (next[id] ?? 0) + amount)
      );

      if (quantity === 0) {
        delete next[id];
      } else {
        next[id] = quantity;
      }

      return next;
    });
  }

  function money(value: number) {
    return `PKR ${value.toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async function saveChanges() {
    if (
      pending ||
      remaining <= 0 ||
      selected.length === 0 ||
      selected.length > 20
    ) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch(
        `/api/orders/${orderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: selected.map((item) => ({
              id: item.id,
              quantity: quantities[item.id],
            })),
            notes,
          }),
        }
      );

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to update order."
        );
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your changes."
      );
    } finally {
      setPending(false);
    }
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");

  if (!editing) {
    return (
      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          className="button button-outline"
          onClick={() => setEditing(true)}
          disabled={remaining <= 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
          }}
        >
          <Pencil size={16} />
          {remaining > 0
            ? `Edit Order (${minutes}:${seconds} left)`
            : "Editing Window Closed"}
        </button>
      </div>
    );
  }

  return (
    <section
      style={{
        marginTop: 25,
        padding: 22,
        background: "#F6F0E8",
        border: "1px solid #E5DACE",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 24,
          }}
        >
          Edit Your Order
        </h3>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontWeight: 700,
            color: remaining > 0
              ? "#956414"
              : "#A23C35",
          }}
        >
          <Clock3 size={17} />
          {minutes}:{seconds}
        </span>
      </div>

      <p
        style={{
          fontSize: 13,
          color: "#81776E",
          lineHeight: 1.8,
          marginBottom: 22,
        }}
      >
        Change quantities or add and remove dishes
        before the editing deadline. Final totals
        will be calculated by the server.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {menu.map((item) => {
          const count = quantities[item.id] ?? 0;

          return (
            <div
              key={item.id}
              style={{
                background: "#FFFCF7",
                padding: 15,
                border: "1px solid #E5DACE",
                borderRadius: 9,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 14,
              }}
            >
              <div>
                <strong>{item.name}</strong>
                <p
                  style={{
                    color: "#81776E",
                    fontSize: 13,
                    marginTop: 5,
                  }}
                >
                  {money(Number(item.price))}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  aria-label={`Remove one ${item.name}`}
                  onClick={() =>
                    changeQuantity(item.id, -1)
                  }
                  disabled={pending || remaining <= 0 || count === 0}
                  style={{ padding: 9 }}
                >
                  <Minus size={17} />
                </button>

                <strong>{count}</strong>

                <button
                  type="button"
                  aria-label={`Add one ${item.name}`}
                  onClick={() =>
                    changeQuantity(item.id, 1)
                  }
                  disabled={
                    pending ||
                    remaining <= 0 ||
                    count >= 20 ||
                    (count === 0 && selected.length >= 20)
                  }
                  style={{ padding: 9 }}
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p
        style={{
          fontWeight: 700,
          fontSize: 19,
          marginTop: 23,
          marginBottom: 18,
        }}
      >
        New subtotal: {money(subtotal)}
      </p>

      <label
        htmlFor={`notes-${orderId}`}
        style={{
          fontWeight: 700,
          fontSize: 13,
          display: "block",
          marginBottom: 10,
        }}
      >
        Special Instructions
      </label>

      <textarea
        id={`notes-${orderId}`}
        rows={3}
        maxLength={500}
        value={notes}
        onChange={(event) =>
          setNotes(event.target.value)
        }
        disabled={pending || remaining <= 0}
        style={fieldStyle}
      />

      {error && (
        <p
          role="alert"
          style={{
            color: "#A23C35",
            marginTop: 15,
          }}
        >
          {error}
        </p>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 22,
        }}
      >
        <button
          type="button"
          className="button button-primary"
          disabled={
            pending ||
            remaining <= 0 ||
            selected.length === 0 ||
            selected.length > 20
          }
          onClick={() => void saveChanges()}
        >
          <Save size={17} />
          {pending ? "Saving..." : "Save Changes"}
        </button>

        <button
          type="button"
          className="button button-outline"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            setError("");
          }}
        >
          <X size={17} />
          Close
        </button>
      </div>
    </section>
  );
}
