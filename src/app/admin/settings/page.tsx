import AccountSettings from "@/components/AccountSettings";
import AuthLayout from "@/components/AuthLayout";
import { requireAdmin } from "@/lib/auth";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  return (
    <AuthLayout title="Admin settings" role="admin" signedIn>
      <AccountSettings role="admin" user={admin} />
    </AuthLayout>
  );
}
