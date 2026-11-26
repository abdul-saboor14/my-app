
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminReservationsPage() {
  await requireAdmin();

  return (
    <main style={{ minHeight: "100vh", padding: "80px 24px", background: "#F6F0E8" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Link href="/admin">← Back to Admin Dashboard</Link>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 48, marginTop: 30 }}>
          Manage Reservations
        </h1>
        <p style={{ marginTop: 16 }}>
          Reservation management is being prepared.
        </p>
      </div>
    </main>
  );
}
