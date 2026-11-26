
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Settings,
  UtensilsCrossed,
  ArrowRight,
  UserRound,
} from "lucide-react";

import AuthForm from "@/components/AuthForm";
import { AccountHeader } from "@/components/AuthLayout";
import { requireUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await requireUser();

  const actions = [
    {
      title: "Book a Table",
      description:
        "Reserve your favourite dining spot at Savoria.",
      href: "/book-table",
      icon: CalendarDays,
    },
    {
      title: "My Reservations",
      description:
        "View your upcoming and previous reservations.",
      href: "/account/reservations",
      icon: ClipboardList,
    },
    {
      title: "Explore Our Menu",
      description:
        "Discover our selection of freshly prepared dishes.",
      href: "/#menu",
      icon: UtensilsCrossed,
    },
    {
      title: "Account Settings",
      description:
        "Update your profile and change your password.",
      href: "/account/settings",
      icon: Settings,
    },
  ];

  return (
    <>
      <AccountHeader />

      <main
        style={{
          minHeight: "100vh",
          background: "#F6F0E8",
          padding: "70px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1050,
            margin: "0 auto",
          }}
        >
          <p
            style={{
              color: "#B96547",
              fontSize: 12,
              letterSpacing: 3,
              fontWeight: 700,
            }}
          >
            SAVORIA CUSTOMER PORTAL
          </p>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(36px, 6vw, 58px)",
              marginTop: 14,
              color: "#291E18",
            }}
          >
            Welcome, {user.fullName}
          </h1>

          <p
            style={{
              color: "#81776E",
              marginTop: 12,
              lineHeight: 1.8,
            }}
          >
            Your personal dining experience starts here.
            Manage your reservations, explore our menu,
            and customise your account.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
              marginTop: 45,
            }}
          >
            {actions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    background: "#FFFCF7",
                    border: "1px solid #E5DACE",
                    borderRadius: 15,
                    padding: 28,
                    color: "#291E18",
                    textDecoration: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 15,
                    minHeight: 225,
                  }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      display: "grid",
                      placeItems: "center",
                      background: "#F3E6DC",
                      color: "#B96547",
                      borderRadius: 12,
                    }}
                  >
                    <Icon size={26} />
                  </div>

                  <h2
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 24,
                    }}
                  >
                    {action.title}
                  </h2>

                  <p
                    style={{
                      color: "#81776E",
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {action.description}
                  </p>

                  <span
                    style={{
                      color: "#B96547",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: "auto",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Open <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>

          <div
            style={{
              background: "#FFFCF7",
              border: "1px solid #E5DACE",
              borderRadius: 15,
              padding: 28,
              marginTop: 35,
            }}
          >
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "Georgia, serif",
                fontSize: 26,
                marginBottom: 20,
              }}
            >
              <UserRound size={23} />
              My Profile
            </h2>

            <p>
              <strong>Name:</strong> {user.fullName}
            </p>

            <p style={{ marginTop: 10 }}>
              <strong>Username:</strong>{" "}
              {user.username ?? "Not set"}
            </p>

            <p style={{ marginTop: 10 }}>
              <strong>Email:</strong> {user.email}
            </p>

            <div style={{ marginTop: 25 }}>
              <AuthForm action="logout" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
