import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";
import { requireUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <AuthLayout title="Your account">
      <dl className="auth-details">
        <div><dt>Name</dt><dd>{user.fullName}</dd></div>
        {user.username && <div><dt>Username</dt><dd>{user.username}</dd></div>}
        <div><dt>Email</dt><dd>{user.email}</dd></div>
      </dl>
      <div className="auth-links">
        <Link href="/account/settings">Account settings</Link>
      </div>
      <AuthForm action="logout" />
    </AuthLayout>
  );
}
