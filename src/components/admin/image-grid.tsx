"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ImageData = {
  id: string;
  filename: string;
  thumbnailUrl: string;
  altText: string | null;
};

type GalleryOption = {
  id: string;
  title: string;
};

export default function ImageGrid({
  images,
  galleries,
}: {
  images: ImageData[];
  galleries: GalleryOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignGalleryId, setAssignGalleryId] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function handleAssign() {
    if (!assignGalleryId || selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/images/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageIds: Array.from(selected),
          galleryId: assignGalleryId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Operation failed.");
        return;
      }
      setSelected(new Set());
      setAssignGalleryId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(imageId: string) {
    if (!window.confirm("Delete this image permanently?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Operation failed.");
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (images.length === 0) {
    return (
      <p className="text-sm text-gray-500">No unsorted images.</p>
    );
  }

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded px-4 py-3">
          <span className="text-sm text-gray-700">
            {selected.size} selected
          </span>
          <select
            value={assignGalleryId}
            onChange={(e) => setAssignGalleryId(e.target.value)}
            className="border border-gray-300 rounded text-sm px-2 py-1"
          >
            <option value="">Assign to gallery...</option>
            {galleries.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!assignGalleryId || busy}
            className="bg-gray-900 text-white text-sm px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            Assign
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {images.map((img) => {
          const isSelected = selected.has(img.id);
          return (
            <div
              key={img.id}
              className="relative group cursor-pointer"
              onClick={() => toggleSelect(img.id)}
            >
              <div
                className={`aspect-square relative rounded overflow-hidden bg-gray-100 ring-2 transition-all ${
                  isSelected ? "ring-gray-900" : "ring-transparent"
                }`}
              >
                <Image
                  src={img.thumbnailUrl}
                  alt={img.altText ?? img.filename}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(img.id);
                }}
                className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
              {isSelected && (
                <div className="absolute top-1 left-1 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
