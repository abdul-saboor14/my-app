
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingBag,
  CalendarDays,
  Plus,
  ReceiptText,
} from "lucide-react";

import { AccountHeader } from "@/components/AuthLayout";
import EditOrderForm from "@/components/EditOrderForm";
import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  price: string;
  total: string;
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  total: string;
  subtotal: string;
  tax: string;
  service: string;
  tableNumber: string | null;
  notes: string;
  items: OrderItem[];
};

const panel: React.CSSProperties = {
  background: "#FFFCF7",
  border: "1px solid #E5DACE",
  borderRadius: 15,
  padding: "clamp(20px, 4vw, 30px)",
};

const money = (value: string) =>
  `PKR ${Number(value).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default async function MyOrdersPage() {
  const user = await requireUser();
  const sql = getDatabase();

  const [orderRows, menuRows] = await Promise.all([
    sql`
      SELECT
        o.id::text AS id,
        o.status,
        o.payment_status,
        o.created_at,
        o.total_amount::text AS total,
        o.subtotal::text AS subtotal,
        o.tax_amount::text AS tax,
        o.service_amount::text AS service,
        o.customer_notes,
        t.table_number,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', oi.menu_item_id,
                'name', oi.item_name,
                'quantity', oi.quantity,
                'price', oi.unit_price::text,
                'total', oi.line_total::text
              ) ORDER BY oi.id
            )
            FROM order_items oi
            WHERE oi.order_id = o.id
          ),
          '[]'::jsonb
        ) AS items
      FROM orders o
      LEFT JOIN reservations r
        ON r.id = o.reservation_id
      LEFT JOIN dining_tables t
        ON t.id = r.dining_table_id
      WHERE o.user_id = ${user.id}::bigint
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 100
    `,
    sql`
      SELECT
        id,
        name,
        price::text AS price
      FROM menu_items
      WHERE is_available = TRUE
      ORDER BY name
    `,
  ]);

  const orders: Order[] = orderRows.map((row) => ({
    id: String(row.id),
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    createdAt: new Date(
      String(row.created_at)
    ).toISOString(),
    total: String(row.total),
    subtotal: String(row.subtotal),
    tax: String(row.tax),
    service: String(row.service),
    tableNumber: row.table_number
      ? String(row.table_number)
      : null,
    notes: row.customer_notes
      ? String(row.customer_notes)
      : "",
    items: row.items as OrderItem[],
  }));

  const menu = menuRows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    price: String(row.price),
  }));

  const now = Date.now();

  return (
    <>
      <AccountHeader />

      <main
        style={{
          minHeight: "100vh",
          background: "#F6F0E8",
          color: "#291E18",
          padding: "65px 20px 100px",
        }}
      >
        <div style={{ maxWidth: 1050, margin: "0 auto" }}>
          <Link
            href="/account"
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
              marginTop: 40,
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
              margin: "16px 0",
            }}
          >
            My Orders
          </h1>

          <p
            style={{
              color: "#81776E",
              lineHeight: 1.8,
              marginBottom: 30,
            }}
          >
            Track your orders and edit eligible
            orders within five minutes of checkout.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 15,
              flexWrap: "wrap",
              marginBottom: 25,
            }}
          >
            <div
              style={{
                ...panel,
                display: "flex",
                alignItems: "center",
                gap: 15,
              }}
            >
              <ReceiptText size={24} color="#B96547" />
              <div>
                <strong style={{ fontSize: 24 }}>
                  {orders.length}
                </strong>
                <p style={{ color: "#81776E", fontSize: 12 }}>
                  Recent Orders
                </p>
              </div>
            </div>

            <Link href="/order" className="button button-primary">
              <Plus size={17} />
              New Order
            </Link>
          </div>

          {orders.length === 0 ? (
            <div style={{ ...panel, textAlign: "center" }}>
              <ShoppingBag
                size={48}
                color="#B96547"
                style={{ margin: "10px auto 20px" }}
              />

              <h2
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 28,
                  marginBottom: 14,
                }}
              >
                No Orders Yet
              </h2>

              <Link href="/order" className="button button-primary">
                Order Food
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 20 }}>
              {orders.map((order) => {
                const eligible =
                  order.status === "pending" &&
                  order.paymentStatus === "unpaid" &&
                  now <
                    new Date(order.createdAt).getTime() +
                      5 * 60 * 1000;

                const statusBackground =
                  order.status === "cancelled"
                    ? "#F8E3E1"
                    : order.status === "completed"
                      ? "#E6F0E4"
                      : "#FFF1D8";

                return (
                  <article key={order.id} style={panel}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <h2
                        style={{
                          fontFamily: "Georgia, serif",
                          fontSize: 27,
                        }}
                      >
                        Order #{order.id}
                      </h2>

                      <span
                        style={{
                          background: statusBackground,
                          borderRadius: 30,
                          padding: "8px 15px",
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      >
                        {order.status}
                      </span>
                    </div>

                    <p
                      style={{
                        color: "#81776E",
                        margin: "13px 0 24px",
                        display: "flex",
                        gap: 9,
                        alignItems: "center",
                        flexWrap: "wrap",
                        fontSize: 13,
                      }}
                    >
                      <CalendarDays size={16} />
                      {formatDate(order.createdAt)}
                      {order.tableNumber &&
                        ` · Table ${order.tableNumber}`}
                    </p>

                    <h3
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: 20,
                        marginBottom: 12,
                      }}
                    >
                      Ordered Dishes
                    </h3>

                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 15,
                          padding: "11px 0",
                          borderBottom: "1px solid #E8DFD4",
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

                    <div
                      style={{
                        marginTop: 20,
                        display: "grid",
                        gap: 9,
                        fontSize: 14,
                      }}
                    >
                      {[
                        ["Subtotal", order.subtotal],
                        ["Tax", order.tax],
                        ["Service", order.service],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <span>{label}</span>
                          <span>{money(value)}</span>
                        </div>
                      ))}

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          borderTop: "1px solid #E8DFD4",
                          paddingTop: 15,
                          marginTop: 8,
                          fontWeight: 700,
                          fontSize: 21,
                        }}
                      >
                        <span>Total</span>
                        <span>{money(order.total)}</span>
                      </div>
                    </div>

                    <p
                      style={{
                        color: "#81776E",
                        fontSize: 13,
                        marginTop: 18,
                      }}
                    >
                      Payment:{" "}
                      <strong>{order.paymentStatus}</strong>
                    </p>

                    {order.notes && (
                      <p
                        style={{
                          marginTop: 12,
                          color: "#81776E",
                          fontSize: 13,
                          lineHeight: 1.7,
                        }}
                      >
                        <strong>Instructions:</strong>{" "}
                        {order.notes}
                      </p>
                    )}

                    {eligible && (
                      <EditOrderForm
                        orderId={order.id}
                        createdAt={order.createdAt}
                        initialNotes={order.notes}
                        initialItems={order.items.map(
                          (item) => ({
                            id: item.id,
                            quantity: item.quantity,
                          })
                        )}
                        menu={menu}
                      />
                    )}
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
