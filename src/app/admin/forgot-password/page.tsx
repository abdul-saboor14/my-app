import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export const metadata: Metadata = { title: "Admin password recovery | Savoria" };

export default function AdminForgotPasswordPage() {
  return (
    <AuthLayout title="Admin password recovery" role="admin">
      <p>Enter the verified email address for your administrator account.</p>
      <AuthForm role="admin" action="forgot-password" />
      <div className="auth-links"><Link href="/admin/login">Back to administrator sign-in</Link></div>
    </AuthLayout>
  );
}
