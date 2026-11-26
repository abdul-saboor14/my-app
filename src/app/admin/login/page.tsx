import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export const metadata: Metadata = { title: "Admin sign-in | Savoria" };

export default async function AdminLoginPage({ searchParams }: {
  searchParams: Promise<{ changed?: string; reset?: string }>;
}) {
  const { changed, reset } = await searchParams;
  return (
    <AuthLayout title="Administrator sign-in" role="admin">
      <p>Use your dedicated administrator account to manage Savoria.</p>
      {(changed === "1" || reset === "1") && <p role="status">Password updated. Sign in with your new password.</p>}
      <AuthForm role="admin" action="login" />
      <div className="auth-links"><Link href="/admin/forgot-password">Set or reset your admin password</Link></div>
    </AuthLayout>
  );
}
