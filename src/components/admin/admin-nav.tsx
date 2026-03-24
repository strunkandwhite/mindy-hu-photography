"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Galleries", href: "/admin/galleries" },
  { label: "Images", href: "/admin/images" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Settings", href: "/admin/settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <nav className="w-56 min-h-screen bg-gray-50 border-r border-gray-200 flex flex-col justify-between p-4">
      <div>
        <div className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6 px-2">
          Admin
        </div>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block px-2 py-1.5 text-sm rounded ${
                  isActive(pathname, item.href)
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={handleSignOut}
        className="text-sm text-gray-500 hover:text-gray-900 px-2 py-1.5 text-left"
      >
        Sign out
      </button>
    </nav>
  );
}
