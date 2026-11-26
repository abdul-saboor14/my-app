
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import BookingForm from "@/components/booking/BookingForm";
import { AccountHeader } from "@/components/AuthLayout";

export default async function BookTablePage() {
  await requireUser();

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
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <Link
            href="/account"
            style={{
              color: "#B96547",
              fontWeight: 700,
            }}
          >
            ← Back to Dashboard
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
            SAVORIA RESERVATIONS
          </p>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(40px, 6vw, 62px)",
              margin: "16px 0",
            }}
          >
            A Table Awaits You.
          </h1>

          <p
            style={{
              color: "#81776E",
              lineHeight: 1.9,
              marginBottom: 38,
            }}
          >
            Choose your preferred dining time and
            reserve the perfect table for your next
            visit to Savoria.
          </p>

          <BookingForm />
        </div>
      </main>
    </>
  );
}
