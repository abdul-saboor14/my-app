"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { accountPaths, type AccountRole } from "@/lib/account-paths";
import { passwordHelp } from "@/lib/auth-policy";

type FieldName = "fullName" | "username" | "email" | "identifier" | "password" | "currentPassword";
type Action = "login" | "register" | "profile" | "password" | "forgot-password" | "reset-password" | "logout";

const fields = {
  fullName: { label: "Full name", type: "text", autoComplete: "name", maxLength: 150 },
  username: { label: "Username", type: "text", autoComplete: "username", maxLength: 30 },
  email: { label: "Email address", type: "email", autoComplete: "email", maxLength: 255 },
  identifier: { label: "Username or email", type: "text", autoComplete: "username", maxLength: 255 },
  password: { label: "Password", type: "password", autoComplete: "new-password", maxLength: 128 },
  currentPassword: { label: "Current password", type: "password", autoComplete: "current-password", maxLength: 128 },
};

const actions: Record<Action, { fields: FieldName[]; label: string }> = {
  login: { fields: ["identifier", "password"], label: "Sign in" },
  register: { fields: ["fullName", "username", "email", "password"], label: "Create account" },
  profile: { fields: ["fullName", "username"], label: "Save profile" },
  password: { fields: ["currentPassword", "password"], label: "Change password" },
  "forgot-password": { fields: ["email"], label: "Send reset link" },
  "reset-password": { fields: ["password"], label: "Reset password" },
  logout: { fields: [], label: "Sign out" },
};

export default function AuthForm({ action, initial, role = "user" }: {
  role?: AccountRole;
  action: Action;
  initial?: Partial<Record<FieldName, string>>;
}) {
  const router = useRouter();
  const config = actions[action];
  const paths = accountPaths[role];
  const next = {
    login: paths.home,
    register: `${paths.login}?registered=1`,
    password: `${paths.login}?changed=1`,
    "reset-password": `${paths.login}?reset=1`,
    logout: paths.login,
    profile: undefined,
    "forgot-password": undefined,
  }[action];
  const label = role === "admin" && action === "logout" ? "Sign out of admin" : config.label;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const newPassword = action !== "login" && config.fields.includes("password");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    setMessage("");

    if (action === "reset-password") {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (!token || !/^[0-9a-f]{64}$/.test(token)) {
        setError("This reset link is invalid. Request a new link.");
        return;
      }
      Object.assign(data, { token });
    }
    setPending(true);

    try {
      const response = await fetch(`${paths.api}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Please try again.");
        return;
      }

      if (next) {
        if (action === "reset-password") window.history.replaceState(null, "", paths.resetPassword);
        router.replace(next);
        router.refresh();
        return;
      }
      setMessage(result.message);
    } catch {
      setError("We couldn’t complete your request. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" className="auth-form" onSubmit={submit} aria-busy={pending}>
      {config.fields.map((name) => {
        const { label, ...input } = fields[name];
        const id = `${action}-${name}`;
        const policy = name === "password" && newPassword;
        return (
          <div className="field" key={id}>
            <label htmlFor={id}>{policy && action !== "register" ? "New password" : label}</label>
            <input
              {...input}
              id={id}
              name={name}
              autoComplete={action === "login" && name === "password" ? "current-password" : input.autoComplete}
              autoCapitalize={name === "fullName" ? "words" : "none"}
              spellCheck={name === "fullName"}
              defaultValue={initial?.[name]}
              minLength={policy ? 12 : undefined}
              aria-describedby={policy ? `${id}-help` : undefined}
              required
            />
            {policy && <small id={`${id}-help`}>{passwordHelp}</small>}
          </div>
        );
      })}
      <div aria-live="polite">{message && <p>{message}</p>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={pending} type="submit">
        {pending ? "Please wait…" : label}
      </button>
    </form>
  );
}
