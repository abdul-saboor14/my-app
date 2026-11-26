import AuthForm from "@/components/AuthForm";
import type { CurrentUser } from "@/lib/auth";
import type { AccountRole } from "@/lib/account-paths";

export default function AccountSettings({ user, role }: { user: CurrentUser; role: AccountRole }) {
  return (
    <>
      <section className="auth-settings" aria-labelledby="profile-title">
        <h2 id="profile-title">Profile</h2>
        <AuthForm role={role} action="profile" initial={{ fullName: user.fullName, username: user.username ?? "" }} />
      </section>
      <section className="auth-settings" aria-labelledby="password-title">
        <h2 id="password-title">Password</h2>
        <p>Changing your password signs this account out on every device.</p>
        <AuthForm role={role} action="password" />
      </section>
    </>
  );
}
