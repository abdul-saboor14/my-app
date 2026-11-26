import Link from "next/link";
import AccountSettings from "@/components/AccountSettings";
import AuthLayout from "@/components/AuthLayout";
import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <AuthLayout title="Account settings">
      <AccountSettings role="user" user={user} />
      <div className="auth-links"><Link href="/account">Back to account</Link></div>
    </AuthLayout>
  );
}
