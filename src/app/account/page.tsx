
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Settings,
  UtensilsCrossed,
  ArrowRight,
  UserRound,
  ShoppingBag,
  ReceiptText,
} from "lucide-react";

import AuthForm from "@/components/AuthForm";
import { AccountHeader } from "@/components/AuthLayout";
import { requireUser } from "@/lib/auth";

const actions = [
  {
    title: "Book a Table",
    description:
      "Reserve your preferred dining table at Savoria.",
    href: "/book-table",
    icon: CalendarDays,
  },
  {
    title: "My Reservations",
    description:
      "View your upcoming and previous table bookings.",
    href: "/account/reservations",
    icon: ClipboardList,
  },
  {
    title: "Order Food",
    description:
      "Choose delicious dishes and place a dine-in order.",
    href: "/order",
    icon: ShoppingBag,
  },
  {
    title: "My Orders",
    description:
      "Track your food orders and review order history.",
    href: "/account/orders",
    icon: ReceiptText,
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

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <>
      <AccountHeader />

      <main
        style={{
          minHeight: "100vh",
          background: "#F6F0E8",
          padding: "70px 20px 100px",
          color: "#291E18",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
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
            Manage your table reservations, place
            food orders, track your dining history,
            and customise your account.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
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
                    textDecoration: "none",
                    color: "#291E18",
                    display: "flex",
                    flexDirection: "column",
                    gap: 15,
                    minHeight: 235,
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
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: "auto",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#B96547",
                    }}
                  >
                    Open Section
                    <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>

          <section
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
          </section>
        </div>
      </main>
    </>
  );
}
