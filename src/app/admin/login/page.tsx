
import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export const metadata: Metadata = {
  title: "Admin Login | Savoria",
};

export default function AdminLoginPage() {
  return (
    <AuthLayout
      title="Administrator Sign In"
      role="admin"
    >
      <p>
        Welcome to Savoria Administration.
        Sign in to manage your restaurant.
      </p>

      <AuthForm role="admin" action="login" />

      <div className="auth-links">
        <Link href="/">
          Back to Restaurant
        </Link>
      </div>
    </AuthLayout>
  );
}
