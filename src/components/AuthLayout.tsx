import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import AuthForm from "@/components/AuthForm";
import type { AccountRole } from "@/lib/account-paths";

export function AccountHeader({ role = "user", signedIn = false }: { role?: AccountRole; signedIn?: boolean }) {
  const admin = role === "admin";
  return (
    <header className={admin ? "account-header admin-header" : "account-header"}>
      <Link href={admin ? (signedIn ? "/admin" : "/admin/login") : "/"} className="wordmark"
        aria-label={admin ? "Savoria administration" : "Savoria home"}>
        Savoria<span className="wordmark-dot">.</span>
      </Link>
      {admin && signedIn ? (
        <nav className="admin-nav" aria-label="Administration">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/menu">Menu</Link>
          <Link href="/admin/settings">Settings</Link>
          <AuthForm role="admin" action="logout" />
        </nav>
      ) : (
        <Link href={admin ? "/" : "/#menu"} className="text-link">
          {admin ? "Back to restaurant" : "Explore the menu"}
        </Link>
      )}
    </header>
  );
}

export default function AuthLayout({ title, children, role = "user", signedIn = false }: {
  title: string;
  children: ReactNode;
  role?: AccountRole;
  signedIn?: boolean;
}) {
  const admin = role === "admin";
  return (
    <>
      <AccountHeader role={role} signedIn={signedIn} />
      <main className={admin ? "auth-main admin-auth-main" : "auth-main"}>
        <div className="auth-card">
          {admin && <ShieldCheck className="admin-auth-icon" aria-hidden="true" size={30} />}
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </>
  );
}
