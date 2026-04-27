"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteGalleryButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm(`Delete gallery "${title}"? Images will be moved to Unsorted.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/galleries/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      router.push("/admin/galleries");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={busy}
        className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete gallery"}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </>
  );
}
