
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AccountHeader } from "@/components/AuthLayout";
import OrderForm from "@/components/OrderForm";
import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { getRestaurantSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const customer = await requireUser();
  const sql = getDatabase();

  const [menuRows, reservationRows, settings] =
    await Promise.all([
      sql`
        SELECT
          id,
          name,
          description,
          price::text AS price
        FROM menu_items
        WHERE is_available = TRUE
        ORDER BY name ASC
      `,
      sql`
        SELECT
          r.id::text AS id,
          t.table_number AS "tableNumber",
          r.starts_at
        FROM reservations r
        JOIN dining_tables t
          ON t.id = r.dining_table_id
        WHERE r.user_id = ${customer.id}
          AND r.status IN ('confirmed', 'seated')
          AND r.ends_at > NOW()
        ORDER BY r.starts_at ASC
      `,
      getRestaurantSettings(),
    ]);

  const menu = menuRows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description),
    price: String(row.price),
  }));

  const reservations = reservationRows.map((row) => ({
    id: String(row.id),
    tableNumber: String(row.tableNumber),
    startsAt: new Date(
      String(row.starts_at)
    ).toISOString(),
  }));

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
            maxWidth: 1020,
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
              letterSpacing: 3,
            }}
          >
            SAVORIA DINING EXPERIENCE
          </p>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(38px, 6vw, 60px)",
              color: "#291E18",
              margin: "16px 0",
            }}
          >
            Order Your Favourites
          </h1>

          <p
            style={{
              color: "#81776E",
              lineHeight: 1.8,
              marginBottom: 36,
            }}
          >
            Select your reservation, explore the
            Savoria menu, and place your dine-in order.
          </p>

          <OrderForm
            menu={menu}
            reservations={reservations}
            taxRate={settings.tax_rate_percent}
            serviceRate={settings.service_charge_percent}
            currency={settings.currency_code}
          />
        </div>
      </main>
    </>
  );
}
