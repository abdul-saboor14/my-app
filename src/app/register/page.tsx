import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export default function RegisterPage() {
  return (
    <AuthLayout title="Create your account">
      <AuthForm action="register" />
      <div className="auth-links"><Link href="/login">Already have an account? Sign in</Link></div>
    </AuthLayout>
  );
}
