
import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function BookTablePage() {
  await requireUser();

  return (
    <main style={{ minHeight: "100vh", padding: "80px 24px", background: "#F6F0E8" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Link href="/account">← Back to Dashboard</Link>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 48, marginTop: 30 }}>
          Reserve a Table
        </h1>
        <p style={{ marginTop: 16 }}>
          Online table reservations are being prepared.
        </p>
      </div>
    </main>
  );
}
