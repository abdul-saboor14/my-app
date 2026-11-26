
import Link from "next/link";
import {
  UtensilsCrossed,
  CalendarCheck,
  Armchair,
  Settings,
  ShoppingBag,
  Wallet,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import { AccountHeader } from "@/components/AuthLayout";
import { requireAdmin } from "@/lib/auth";

const adminSections = [
  {
    title: "Manage Menu",
    description:
      "Add, edit and remove restaurant dishes and prices.",
    href: "/admin/menu",
    icon: UtensilsCrossed,
  },
  {
    title: "Manage Reservations",
    description:
      "Review reservations and manage booking statuses.",
    href: "/admin/reservations",
    icon: CalendarCheck,
  },
  {
    title: "Manage Dining Tables",
    description:
      "Manage seating capacity, locations and table availability.",
    href: "/admin/tables",
    icon: Armchair,
  },
  {
    title: "Manage Food Orders",
    description:
      "Review customer orders and manage kitchen preparation.",
    href: "/admin/orders",
    icon: ShoppingBag,
  },
  {
    title: "Manage Payments",
    description:
      "Review unpaid balances and record verified payments.",
    href: "/admin/payments",
    icon: Wallet,
  },
  {
    title: "Admin Settings",
    description:
      "Manage your administrator profile and password.",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <>
      <AccountHeader role="admin" signedIn />

      <main
        style={{
          minHeight: "100vh",
          background: "#F6F0E8",
          padding: "70px 20px 110px",
          color: "#291E18",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <div style={{ marginBottom: 45 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#B96547",
                fontSize: 12,
                letterSpacing: 2,
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={20} />
              SAVORIA ADMINISTRATION
            </div>

            <h1
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "clamp(38px, 6vw, 60px)",
                margin: "20px 0 15px",
              }}
            >
              Admin Dashboard
            </h1>

            <p
              style={{
                fontSize: 17,
                color: "#81776E",
                lineHeight: 1.8,
              }}
            >
              Welcome back, {admin.fullName}.
              Manage your restaurant operations
              from one place.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 22,
            }}
          >
            {adminSections.map((section) => {
              const Icon = section.icon;

              return (
                <Link
                  key={section.href}
                  href={section.href}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    background: "#FFFCF7",
                    padding: 30,
                    borderRadius: 16,
                    border: "1px solid #E5DACE",
                    textDecoration: "none",
                    color: "#291E18",
                    minHeight: 250,
                    boxShadow:
                      "0 6px 20px rgba(50, 30, 20, 0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      display: "grid",
                      placeItems: "center",
                      justifyContent: "center",
                      background: "#F3E6DC",
                      borderRadius: 13,
                      color: "#B96547",
                      marginBottom: 23,
                    }}
                  >
                    <Icon size={27} />
                  </div>

                  <h2
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 25,
                      marginBottom: 13,
                    }}
                  >
                    {section.title}
                  </h2>

                  <p
                    style={{
                      color: "#81776E",
                      fontSize: 14,
                      lineHeight: 1.8,
                      flex: 1,
                    }}
                  >
                    {section.description}
                  </p>

                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 25,
                      color: "#B96547",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Open Section
                    <ArrowRight size={17} />
                  </span>
                </Link>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 45,
              background: "#291E18",
              color: "#F6F0E8",
              borderRadius: 15,
              padding: "26px 30px",
            }}
          >
            <p
              style={{
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Savoria Restaurant Management
            </p>

            <p
              style={{
                opacity: 0.75,
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              Customer accounts and administrator
              accounts are separated. Management
              operations require administrator access.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
