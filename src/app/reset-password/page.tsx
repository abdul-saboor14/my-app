import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export const metadata: Metadata = { title: "Reset password | Savoria", referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Set a new password">
      <AuthForm action="reset-password" />
      <div className="auth-links"><Link href="/forgot-password">Request a new reset link</Link></div>
    </AuthLayout>
  );
}
