import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { parseSessionCookie, isSessionExpired, getNewExpiresAt } from "@/lib/auth";
import AdminNav from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const sessionId = parseSessionCookie(cookieHeader);

  if (!sessionId) {
    redirect("/admin/login");
  }

  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = rows[0];

  if (!session || isSessionExpired(session.expiresAt)) {
    if (session) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
    redirect("/admin/login");
  }

  // Refresh session expiry
  await db
    .update(sessions)
    .set({ expiresAt: getNewExpiresAt() })
    .where(eq(sessions.id, sessionId));

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
