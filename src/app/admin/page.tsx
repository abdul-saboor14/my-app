import Link from "next/link";
import AuthLayout from "@/components/AuthLayout";
import { requireAdmin } from "@/lib/auth";

export default async function AdminPage() {
  const admin = await requireAdmin();
  return (
    <AuthLayout title="Admin dashboard" role="admin" signedIn>
      <p>Signed in as {admin.fullName}</p>
      <div className="auth-links">
        <Link href="/admin/menu">Manage the menu</Link>
        <Link href="/admin/settings">Manage your admin account</Link>
      </div>
    </AuthLayout>
  );
}
