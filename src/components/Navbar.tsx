
"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Menu,
  X,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const links = [
  { href: "/#home", label: "Home" },
  { href: "/#menu", label: "Our Menu" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <header className="site-header">
      <nav
        className="nav-container container-wide"
        aria-label="Main navigation"
      >
        {/* Savoria Logo */}
        <Link
          href="/"
          className="wordmark"
          onClick={closeMenu}
          aria-label="Savoria home"
        >
          Savoria
          <span className="wordmark-dot">.</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="nav-links desktop-nav">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}

          <Link href="/account">
            <UserRound size={16} />
            Customer Account
          </Link>

          <Link href="/admin/login">
            <ShieldCheck size={16} />
            Admin Login
          </Link>
        </div>

        {/* Desktop Button */}
        <Link
          href="/#menu"
          className="button button-small desktop-cta"
        >
          Explore Menu
          <ArrowUpRight size={16} />
        </Link>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={
            open ? "Close menu" : "Open menu"
          }
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Navigation */}
      {open && (
        <div
          id="mobile-navigation"
          className="mobile-nav"
        >
          {links.map((link) => (
            <Link
              href={link.href}
              key={link.href}
              onClick={closeMenu}
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/account"
            onClick={closeMenu}
          >
            <UserRound size={18} />
            Customer Account
          </Link>

          <Link
            href="/admin/login"
            onClick={closeMenu}
          >
            <ShieldCheck size={18} />
            Admin Login
          </Link>

          <Link
            href="/#menu"
            className="button"
            onClick={closeMenu}
          >
            Explore Menu
            <ArrowUpRight size={17} />
          </Link>
        </div>
      )}
    </header>
  );
}
