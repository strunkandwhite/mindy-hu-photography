"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  sessionType: string;
  isRead: number;
  createdAt: string;
};

export default function MessageList({
  messages: initialMessages,
}: {
  messages: Message[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleRead(msg: Message) {
    setBusy(msg.id);
    try {
      await fetch(`/api/admin/messages/${msg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: msg.isRead ? 0 : 1 }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this message?")) return;
    setBusy(id);
    try {
      await fetch(`/api/admin/messages/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (initialMessages.length === 0) {
    return <p className="text-sm text-gray-500">No messages yet.</p>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {initialMessages.map((msg) => (
        <div
          key={msg.id}
          className={`py-5 ${msg.isRead ? "opacity-60" : ""}`}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {msg.name}
              </span>
              <span className="text-xs text-gray-500">{msg.email}</span>
              {msg.phone && (
                <span className="text-xs text-gray-400">{msg.phone}</span>
              )}
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {msg.sessionType}
              </span>
              {!msg.isRead && (
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
              )}
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {new Date(msg.createdAt).toLocaleDateString()}
            </span>
          </div>

          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">
            {msg.message}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleRead(msg)}
              disabled={busy === msg.id}
              className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
            >
              {msg.isRead ? "Mark unread" : "Mark read"}
            </button>
            <button
              onClick={() => handleDelete(msg.id)}
              disabled={busy === msg.id}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
