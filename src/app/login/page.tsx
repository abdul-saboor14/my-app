import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AuthLayout from "@/components/AuthLayout";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ registered?: string; changed?: string; reset?: string }>;
}) {
  const { registered, changed, reset } = await searchParams;
  return (
    <AuthLayout title="Sign in">
      {registered === "1" && <p role="status">Account created. You can now sign in.</p>}
      {(changed === "1" || reset === "1") && <p role="status">Password updated. Sign in with your new password.</p>}
      <AuthForm action="login" />
      <div className="auth-links">
        <Link href="/forgot-password">Forgot your password?</Link>
        <Link href="/register">Create an account</Link>
      </div>
    </AuthLayout>
  );
}
