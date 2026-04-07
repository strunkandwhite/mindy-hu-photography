"use client";

import { usePathname } from "next/navigation";

export function ConditionalFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <>{children}</>;
}
