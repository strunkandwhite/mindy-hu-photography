import { db } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { desc } from "drizzle-orm";
import MessageList from "@/components/admin/message-list";

export default async function AdminMessagesPage() {
  const messages = await db
    .select()
    .from(contactSubmissions)
    .orderBy(desc(contactSubmissions.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-light text-gray-900 mb-8">Messages</h1>
      <MessageList messages={messages} />
    </div>
  );
}
