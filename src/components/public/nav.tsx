"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Overview" },
  { href: "/galleries", label: "Galleries" },
  { href: "/contact", label: "Contact" },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-3 flex justify-between items-center py-8">
        <Link href="/" className="text-[32px] tracking-[16px] text-gray-900">
          MINDY HU
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[16px] tracking-widest transition-colors ${
                  active ? "text-gray-900 underline underline-offset-8" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {/* Intentionally hardcoded to match the reference design — not driven
              by the admin socialLinks setting (which feeds the footer). */}
          <a
            href="https://instagram.com/huismindy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-900 hover:text-gray-600 transition-colors"
            aria-label="Instagram"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </a>
        </div>

        <button
          className="md:hidden text-gray-700"
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
      </div>

      {menuOpen && (
        <div className="max-w-[1400px] mx-auto bg-white/95 backdrop-blur-sm py-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-[16px] text-gray-600 tracking-wider"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
