"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/contact", label: "Contact" },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-5 transition-colors duration-300 ${
        isHome ? "" : "bg-white/90 backdrop-blur-sm"
      }`}
    >
      <Link
        href="/"
        className={`font-heading text-base tracking-wider ${
          isHome ? "text-white" : "text-gray-800"
        }`}
      >
        MH
      </Link>
      {/* Desktop nav */}
      <div className="hidden md:flex gap-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-xs tracking-widest transition-colors ${
              isHome
                ? "text-white/80 hover:text-white"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {link.label.toUpperCase()}
          </Link>
        ))}
      </div>
      {/* Mobile hamburger */}
      <button
        className={`md:hidden ${isHome ? "text-white" : "text-gray-600"}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          {menuOpen ? (
            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
          ) : (
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" fill="none" />
          )}
        </svg>
      </button>
      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-sm py-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-6 py-2 text-sm text-gray-600 tracking-wider"
            >
              {link.label.toUpperCase()}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
