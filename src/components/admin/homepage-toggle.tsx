"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HomepageToggle({
  id,
  showOnHomepage,
}: {
  id: string;
  showOnHomepage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleChange(checked: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/galleries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showOnHomepage: checked ? 1 : 0 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Could not update homepage visibility.");
        return;
      }
      router.refresh();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-600">
      <input
        type="checkbox"
        checked={showOnHomepage}
        disabled={busy}
        onChange={(e) => handleChange(e.target.checked)}
        className="rounded border-gray-300 disabled:opacity-50"
      />
      Homepage
    </label>
  );
}
