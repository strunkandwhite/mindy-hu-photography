import { db } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { withAdminAuth } from "@/lib/api-helpers";

export const GET = withAdminAuth(async () => {
  const messages = await db
    .select()
    .from(contactSubmissions)
    .orderBy(desc(contactSubmissions.createdAt));

  return Response.json(messages);
});
