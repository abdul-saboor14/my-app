import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export const metadata: Metadata = { title: "Reset admin password | Savoria", referrer: "no-referrer" };

export default function AdminResetPasswordPage() {
  return (
    <AuthLayout title="Set your admin password" role="admin">
      <AuthForm role="admin" action="reset-password" />
      <div className="auth-links"><Link href="/admin/forgot-password">Request a new admin reset link</Link></div>
    </AuthLayout>
  );
}
