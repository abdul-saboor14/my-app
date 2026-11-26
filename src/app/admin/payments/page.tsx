
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ArrowLeft,
  Wallet,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  ReceiptText,
} from "lucide-react";

import { AccountHeader } from "@/components/AuthLayout";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

type PaymentOrder = {
  id: string;
  customerName: string;
  tableNumber: string | null;
  status: string;
  paymentStatus: string;
  total: string;
  createdAt: string;
};

const panel: React.CSSProperties = {
  background: "#FFFCF7",
  border: "1px solid #E5DACE",
  borderRadius: 15,
  padding: "clamp(20px, 4vw, 28px)",
};

function formatMoney(value: string | number) {
  return `PKR ${Number(value).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// Record a payment that the restaurant has
// independently verified as received.
async function recordPayment(formData: FormData) {
  "use server";

  await requireAdmin();

  const id = formData.get("id");
  const acknowledged = formData.get("acknowledged");

  if (
    typeof id !== "string" ||
    !/^[1-9]\d{0,17}$/.test(id) ||
    acknowledged !== "yes"
  ) {
    redirect("/admin/payments?result=invalid");
  }

  const sql = getDatabase();

  let result = "unchanged";

  try {
    const rows = await sql`
      UPDATE orders
      SET payment_status = 'paid',
          updated_at = NOW()
      WHERE id = ${id}::bigint
        AND payment_status = 'unpaid'
        AND status IN (
          'confirmed',
          'preparing',
          'ready',
          'served',
          'completed'
        )
      RETURNING id
    `;

    result = rows.length ? "paid" : "unchanged";
  } catch (error) {
    console.error("Payment recording failed:", error);
    result = "error";
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath("/account/orders");

  redirect(`/admin/payments?result=${result}`);
}

const messages: Record<string, string> = {
  paid: "Payment successfully recorded as received.",
  unchanged:
    "Payment was not changed. The order may be cancelled, pending confirmation, or already paid.",
  invalid: "Invalid payment confirmation.",
  error:
    "Unable to record this payment. Check the server logs.",
};

export default async function AdminPaymentsPage({
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
      t.table_number,
      o.status,
      o.payment_status,
      o.total_amount::text AS total,
      o.created_at
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN reservations r
      ON r.id = o.reservation_id
    LEFT JOIN dining_tables t
      ON t.id = r.dining_table_id
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT 100
  `;

  const orders: PaymentOrder[] = rows.map((row) => ({
    id: String(row.id),
    customerName: String(row.customer_name),
    tableNumber: row.table_number
      ? String(row.table_number)
      : null,
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    total: String(row.total),
    createdAt: new Date(
      String(row.created_at)
    ).toISOString(),
  }));

  const unpaid = orders.filter(
    (order) => order.paymentStatus === "unpaid"
  );

  const paid = orders.filter(
    (order) => order.paymentStatus === "paid"
  );

  const unpaidTotal = unpaid.reduce(
    (sum, order) => sum + Number(order.total),
    0
  );

  return (
    <>
      <AccountHeader role="admin" signedIn />

      <main
        style={{
          minHeight: "100vh",
          padding: "65px 20px 100px",
          background: "#F6F0E8",
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
            SAVORIA ADMINISTRATION
          </p>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(38px, 6vw, 58px)",
              margin: "16px 0",
            }}
          >
            Manage Payments
          </h1>

          <p
            style={{
              color: "#81776E",
              lineHeight: 1.8,
              marginBottom: 32,
            }}
          >
            Review order balances and manually record
            payments received by the restaurant.
          </p>

          <div
            style={{
              background: "#FFF1D8",
              color: "#76531F",
              padding: 20,
              borderRadius: 12,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 27,
              lineHeight: 1.7,
              fontSize: 13,
            }}
          >
            <AlertTriangle size={22} />
            <span>
              Only mark an order as paid after you have
              independently received and verified the
              full payment. This website does not
              process payments or initiate refunds.
            </span>
          </div>

          {result && messages[result] && (
            <div
              role="status"
              style={{
                ...panel,
                marginBottom: 25,
                color: result === "paid"
                  ? "#39734A"
                  : "#956414",
              }}
            >
              {messages[result]}
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
            <Summary
              icon={<ReceiptText size={26} />}
              label="Recent Orders"
              value={String(orders.length)}
            />

            <Summary
              icon={<Clock3 size={26} />}
              label="Unpaid Orders"
              value={String(unpaid.length)}
            />

            <Summary
              icon={<CheckCircle2 size={26} />}
              label="Paid Orders"
              value={String(paid.length)}
            />

            <Summary
              icon={<Wallet size={26} />}
              label="Unpaid Balance"
              value={formatMoney(unpaidTotal)}
            />
          </div>

          <h2
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 30,
              marginBottom: 22,
            }}
          >
            Recent Payment Records
          </h2>

          {orders.length === 0 ? (
            <div style={panel}>
              <p>No orders have been placed yet.</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 18,
              }}
            >
              {orders.map((order) => {
                const canRecord =
                  order.paymentStatus === "unpaid" &&
                  [
                    "confirmed",
                    "preparing",
                    "ready",
                    "served",
                    "completed",
                  ].includes(order.status);

                return (
                  <article
                    key={order.id}
                    style={panel}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 18,
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            color: "#B96547",
                            fontSize: 12,
                            letterSpacing: 2,
                            fontWeight: 700,
                          }}
                        >
                          ORDER #{order.id}
                        </p>

                        <h3
                          style={{
                            fontFamily: "Georgia, serif",
                            fontSize: 25,
                            margin: "9px 0",
                          }}
                        >
                          {order.customerName}
                        </h3>

                        <p
                          style={{
                            fontSize: 13,
                            color: "#81776E",
                            lineHeight: 1.8,
                          }}
                        >
                          {formatDate(order.createdAt)}
                          {order.tableNumber &&
                            ` · Table ${order.tableNumber}`}
                        </p>
                      </div>

                      <div
                        style={{
                          textAlign: "right",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 22,
                          }}
                        >
                          {formatMoney(order.total)}
                        </strong>

                        <p
                          style={{
                            marginTop: 8,
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "capitalize",
                            color:
                              order.paymentStatus === "paid"
                                ? "#39734A"
                                : "#956414",
                          }}
                        >
                          Payment:{" "}
                          {order.paymentStatus.replaceAll(
                            "_",
                            " "
                          )}
                        </p>

                        <p
                          style={{
                            marginTop: 5,
                            color: "#81776E",
                            fontSize: 12,
                          }}
                        >
                          Order: {order.status}
                        </p>
                      </div>
                    </div>

                    {canRecord ? (
                      <form
                        action={recordPayment}
                        style={{
                          marginTop: 22,
                          paddingTop: 20,
                          borderTop: "1px solid #E8DFD4",
                        }}
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={order.id}
                        />

                        <label
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            fontSize: 13,
                            lineHeight: 1.7,
                            marginBottom: 17,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            name="acknowledged"
                            value="yes"
                            required
                            style={{
                              marginTop: 4,
                              accentColor: "#B96547",
                            }}
                          />
                          I confirm that Savoria has
                          received the full payment
                          for this order.
                        </label>

                        <button
                          type="submit"
                          className="button button-primary"
                        >
                          <CheckCircle2 size={17} />
                          Record Payment Received
                        </button>
                      </form>
                    ) : (
                      <p
                        style={{
                          color: "#81776E",
                          fontSize: 13,
                          marginTop: 19,
                          borderTop: "1px solid #E8DFD4",
                          paddingTop: 15,
                        }}
                      >
                        {order.paymentStatus === "paid"
                          ? "Payment has been recorded."
                          : order.paymentStatus === "unpaid"
                            ? "Confirm the order before recording payment."
                            : "Payment adjustments require separate verification."}
                      </p>
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

function Summary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={panel}>
      <div style={{ color: "#B96547" }}>
        {icon}
      </div>

      <p
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 29,
          fontWeight: 700,
          margin: "13px 0 8px",
          overflowWrap: "anywhere",
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
        {label}
      </p>
    </div>
  );
}
