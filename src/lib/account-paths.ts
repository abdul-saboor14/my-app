export type AccountRole = "user" | "admin";

export const accountPaths = {
  user: {
    api: "/api/auth",
    login: "/login",
    home: "/account",
    resetPassword: "/reset-password",
  },
  admin: {
    api: "/api/admin/auth",
    login: "/admin/login",
    home: "/admin",
    resetPassword: "/admin/reset-password",
  },
} satisfies Record<AccountRole, Record<string, string>>;
