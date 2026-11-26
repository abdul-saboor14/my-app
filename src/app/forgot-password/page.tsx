import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Forgot your password?">
      <p>Enter your account email to request a password reset link.</p>
      <AuthForm action="forgot-password" />
      <div className="auth-links"><Link href="/login">Back to sign in</Link></div>
    </AuthLayout>
  );
}
