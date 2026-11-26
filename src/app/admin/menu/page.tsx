import Link from "next/link";
import { AccountHeader } from "@/components/AuthLayout";
import MenuManager from "@/components/MenuManager";
import { requireAdmin } from "@/lib/auth";

export default async function AdminMenuPage() {
  await requireAdmin();
  return (
    <>
      <AccountHeader role="admin" signedIn />
      <main>
        <div className="container-wide admin-menu-header">
          <Link href="/admin" className="text-link">Back to dashboard</Link>
          <h1>Manage the menu</h1>
        </div>
        <MenuManager editable />
      </main>
    </>
  );
}
