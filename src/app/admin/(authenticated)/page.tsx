import { db } from "@/db/client";
import { galleries, images, contactSubmissions } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";

export default async function AdminDashboard() {
  const [galleryCount, imageCount, unreadCount, recentMessages] =
    await Promise.all([
      db.select({ value: count() }).from(galleries),
      db.select({ value: count() }).from(images),
      db
        .select({ value: count() })
        .from(contactSubmissions)
        .where(eq(contactSubmissions.isRead, 0)),
      db
        .select()
        .from(contactSubmissions)
        .orderBy(desc(contactSubmissions.createdAt))
        .limit(5),
    ]);

  const stats = [
    { label: "Galleries", value: galleryCount[0]?.value ?? 0 },
    { label: "Images", value: imageCount[0]?.value ?? 0 },
    { label: "Unread Messages", value: unreadCount[0]?.value ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-light text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border border-gray-200 rounded p-5"
          >
            <div className="text-sm text-gray-500 mb-1">{stat.label}</div>
            <div className="text-2xl font-medium text-gray-900">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-light text-gray-900 mb-4">
        Recent Messages
      </h2>
      {recentMessages.length === 0 ? (
        <p className="text-sm text-gray-500">No messages yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {recentMessages.map((msg) => (
            <li key={msg.id} className="py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {msg.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {msg.sessionType}
                  </span>
                  {!msg.isRead && (
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <p className="text-sm text-gray-600 truncate">{msg.message}</p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(msg.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
