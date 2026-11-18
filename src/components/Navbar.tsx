"use client";

import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

const links = [
  { href: "#home", label: "Home" },
  { href: "#menu", label: "Our Menu" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <nav
        className="nav-container container-wide"
        aria-label="Main navigation"
      >
        <a
          href="#home"
          className="wordmark"
          onClick={() => setOpen(false)}
          aria-label="Savoria home"
        >
          Savoria<span className="wordmark-dot">.</span>
        </a>

        <div className="nav-links desktop-nav">
          {links.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </div>

        <a
          href="#menu"
          className="button button-small desktop-cta"
        >
          Explore Menu
          <ArrowUpRight size={16} />
        </a>

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {open && (
        <div id="mobile-navigation" className="mobile-nav">
          {links.map((link) => (
            <a
              href={link.href}
              key={link.href}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}

          <a
            href="#menu"
            className="button"
            onClick={() => setOpen(false)}
          >
            Explore Menu
            <ArrowUpRight size={17} />
          </a>
        </div>
      )}
    </header>
  );
}