
import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function CustomerReservationsPage() {
  await requireUser();

  return (
    <main style={{ minHeight: "100vh", padding: "80px 24px", background: "#F6F0E8" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Link href="/account">← Back to Dashboard</Link>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 48, marginTop: 30 }}>
          My Reservations
        </h1>
        <p style={{ marginTop: 16 }}>
          Your reservations will appear here when booking is enabled.
        </p>
      </div>
    </main>
  );
}
