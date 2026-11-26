
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ArrowLeft,
  ShoppingBag,
  Clock3,
  Users,
  ChefHat,
  ReceiptText,
  CheckCircle2,
} from "lucide-react";

import { AccountHeader } from "@/components/AuthLayout";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

type OrderedItem = {
  name: string;
  quantity: number;
  price: string;
  total: string;
};

type Order = {
  id: string;
  customerName: string;
  customerEmail: string;
  tableNumber: string | null;
  reservationId: string | null;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: string;
  subtotal: string;
  tax: string;
  service: string;
  total: string;
  notes: string | null;
  items: OrderedItem[];
};

const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["served"],
  served: ["completed"],
  completed: [],
  cancelled: [],
};

const statusStyles: Record<
  OrderStatus,
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
  preparing: {
    background: "#E2EAF7",
    color: "#365D91",
  },
  ready: {
    background: "#E2EAF7",
    color: "#365D91",
  },
  served: {
    background: "#E8E4F0",
    color: "#645579",
  },
  completed: {
    background: "#E6F0E4",
    color: "#39734A",
  },
  cancelled: {
    background: "#F8E3E1",
    color: "#A23C35",
  },
};

const panel: React.CSSProperties = {
  background: "#FFFCF7",
  border: "1px solid #E5DACE",
  borderRadius: 15,
  padding: "clamp(20px, 4vw, 30px)",
};

function money(value: string) {
  return `PKR ${Number(value).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function orderDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(
    /\b\w/g,
    (character) => character.toUpperCase()
  );
}

// This Server Action is only accessible to
// authenticated administrators.
async function changeOrderStatus(formData: FormData) {
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
    !Object.prototype.hasOwnProperty.call(
      transitions,
      current
    ) ||
    !transitions[current as OrderStatus].includes(
      next as OrderStatus
    )
  ) {
    redirect("/admin/orders?result=invalid");
  }

  const sql = getDatabase();

  const rows = await sql`
    UPDATE orders
    SET
      status = ${next},
      updated_at = NOW()
    WHERE
      id = ${id}::bigint
      AND status = ${current}
    RETURNING id
  `;

  revalidatePath("/admin/orders");
  revalidatePath("/account/orders");

  redirect(
    rows.length
      ? "/admin/orders?result=updated"
      : "/admin/orders?result=unchanged"
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdmin();

  const { result } = await searchParams;
  const sql = getDatabase();

  const rows = await sql`
    SELECT
      o.id::text AS id,
      u.full_name AS customer_name,
      u.email AS customer_email,
      t.table_number,
      o.reservation_id::text AS reservation_id,
      o.created_at,
      o.status,
      o.payment_status,
      o.subtotal::text AS subtotal,
      o.tax_amount::text AS tax,
      o.service_amount::text AS service,
      o.total_amount::text AS total,
      o.customer_notes,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'name', oi.item_name,
              'quantity', oi.quantity,
              'price', oi.unit_price::text,
              'total', oi.line_total::text
            )
            ORDER BY oi.id
          )
          FROM order_items oi
          WHERE oi.order_id = o.id
        ),
        '[]'::jsonb
      ) AS items
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN reservations r
      ON r.id = o.reservation_id
    LEFT JOIN dining_tables t
      ON t.id = r.dining_table_id
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT 100
  `;

  const orders: Order[] = rows.map((row) => ({
    id: String(row.id),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    tableNumber: row.table_number
      ? String(row.table_number)
      : null,
    reservationId: row.reservation_id
      ? String(row.reservation_id)
      : null,
    createdAt: new Date(
      String(row.created_at)
    ).toISOString(),
    status: String(row.status) as OrderStatus,
    paymentStatus: String(row.payment_status),
    subtotal: String(row.subtotal),
    tax: String(row.tax),
    service: String(row.service),
    total: String(row.total),
    notes: row.customer_notes
      ? String(row.customer_notes)
      : null,
    items: row.items as OrderedItem[],
  }));

  const pending = orders.filter(
    (order) => order.status === "pending"
  ).length;

  const inProgress = orders.filter((order) =>
    ["confirmed", "preparing", "ready", "served"]
      .includes(order.status)
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
              marginTop: 40,
              color: "#B96547",
              letterSpacing: 3,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            SAVORIA RESTAURANT MANAGEMENT
          </p>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(38px, 6vw, 58px)",
              margin: "16px 0",
            }}
          >
            Manage Food Orders
          </h1>

          <p
            style={{
              color: "#81776E",
              lineHeight: 1.8,
              marginBottom: 35,
            }}
          >
            Review orders, manage kitchen preparation,
            and update their fulfilment status.
          </p>

          {result && (
            <div
              role="status"
              style={{
                ...panel,
                marginBottom: 24,
                color:
                  result === "updated"
                    ? "#39734A"
                    : "#956414",
              }}
            >
              {result === "updated"
                ? "Order status updated successfully."
                : result === "unchanged"
                  ? "This order has changed. Refresh and try again."
                  : "Invalid order status update."}
            </div>
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
            <SummaryCard
              label="Recent Orders"
              value={orders.length}
              icon={<ShoppingBag size={26} />}
            />
            <SummaryCard
              label="Pending"
              value={pending}
              icon={<Clock3 size={26} />}
            />
            <SummaryCard
              label="In Progress"
              value={inProgress}
              icon={<ChefHat size={26} />}
            />
          </div>

          {orders.length === 0 ? (
            <section
              style={{
                ...panel,
                textAlign: "center",
                padding: 55,
              }}
            >
              <ShoppingBag
                size={48}
                color="#B96547"
                style={{ margin: "0 auto 20px" }}
              />
              <h2
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 29,
                  marginBottom: 12,
                }}
              >
                No Orders Yet
              </h2>
              <p style={{ color: "#81776E" }}>
                Customer food orders will appear here.
              </p>
            </section>
          ) : (
            <div style={{ display: "grid", gap: 20 }}>
              {orders.map((order) => {
                const badge = statusStyles[order.status];
                const allowed =
                  transitions[order.status] ?? [];

                return (
                  <article key={order.id} style={panel}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 16,
                        marginBottom: 22,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: 12,
                            letterSpacing: 2,
                            color: "#B96547",
                            fontWeight: 700,
                          }}
                        >
                          ORDER #{order.id}
                        </p>
                        <h2
                          style={{
                            fontFamily: "Georgia, serif",
                            fontSize: 26,
                            marginTop: 8,
                          }}
                        >
                          {order.customerName}
                        </h2>
                        <p
                          style={{
                            fontSize: 13,
                            color: "#81776E",
                            marginTop: 6,
                          }}
                        >
                          {order.customerEmail}
                        </p>
                      </div>

                      <span
                        style={{
                          background: badge.background,
                          color: badge.color,
                          padding: "8px 15px",
                          borderRadius: 30,
                          fontSize: 12,
                          fontWeight: 700,
                          height: "fit-content",
                        }}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 20,
                        flexWrap: "wrap",
                        color: "#81776E",
                        fontSize: 13,
                        marginBottom: 24,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <Clock3 size={17} />
                        {orderDate(order.createdAt)}
                      </span>

                      {order.tableNumber && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <Users size={17} />
                          Table {order.tableNumber}
                        </span>
                      )}

                      <span>
                        Payment:{" "}
                        {statusLabel(order.paymentStatus)}
                      </span>
                    </div>

                    <div
                      style={{
                        background: "#F6F0E8",
                        borderRadius: 10,
                        padding: 20,
                      }}
                    >
                      <h3
                        style={{
                          fontFamily: "Georgia, serif",
                          fontSize: 21,
                          marginBottom: 12,
                        }}
                      >
                        Ordered Items
                      </h3>

                      {order.items.map((item, index) => (
                        <div
                          key={`${order.id}-${index}`}
                          style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 15,
                            padding: "9px 0",
                            borderBottom:
                              "1px solid #E5DACE",
                          }}
                        >
                          <span>
                            {item.quantity} × {item.name}
                          </span>
                          <strong>
                            {money(item.total)}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <p
                        style={{
                          marginTop: 18,
                          color: "#81776E",
                          fontSize: 13,
                        }}
                      >
                        <strong>Customer Instructions:</strong>{" "}
                        {order.notes}
                      </p>
                    )}

                    <div
                      style={{
                        marginTop: 22,
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 15,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <ReceiptText
                          size={22}
                          color="#B96547"
                        />
                        <strong
                          style={{
                            fontSize: 22,
                          }}
                        >
                          {money(order.total)}
                        </strong>
                      </div>

                      <span
                        style={{
                          color: "#81776E",
                          fontSize: 12,
                        }}
                      >
                        Total includes tax and service
                      </span>
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid #E8DFD4",
                        paddingTop: 22,
                        marginTop: 24,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 14,
                        }}
                      >
                        Update Order Status
                      </h3>

                      {allowed.length === 0 ? (
                        <p
                          style={{
                            color: "#81776E",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 13,
                          }}
                        >
                          <CheckCircle2
                            size={17}
                            color="#54775B"
                          />
                          This order has reached a final status.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          {allowed.map((next) => (
                            <form
                              action={changeOrderStatus}
                              key={next}
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={order.id}
                              />
                              <input
                                type="hidden"
                                name="current"
                                value={order.status}
                              />
                              <input
                                type="hidden"
                                name="next"
                                value={next}
                              />

                              <button
                                type="submit"
                                className={
                                  next === "cancelled"
                                    ? "button button-outline"
                                    : "button button-primary"
                                }
                                style={{
                                  fontSize: 12,
                                  padding: "12px 17px",
                                }}
                              >
                                {next === "cancelled"
                                  ? "Cancel Order"
                                  : next === "confirmed"
                                    ? "Confirm Order"
                                    : next === "preparing"
                                      ? "Start Preparing"
                                      : next === "ready"
                                        ? "Mark Ready"
                                        : next === "served"
                                          ? "Mark Served"
                                          : "Complete Order"}
                              </button>
                            </form>
                          ))}
                        </div>
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

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div style={panel}>
      <div style={{ color: "#B96547" }}>{icon}</div>
      <h2
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 35,
          margin: "13px 0 7px",
        }}
      >
        {value}
      </h2>
      <p style={{ fontSize: 13, color: "#81776E" }}>
        {label}
      </p>
    </div>
  );
}
