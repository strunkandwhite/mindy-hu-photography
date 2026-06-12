"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ImageRow = {
  id: string;
  thumbnailUrl: string;
  filename: string;
  altText: string | null;
};

type GalleryOption = { id: string; title: string };

export function GalleryImageManager({
  galleryId,
  images,
  coverImageId,
  otherGalleries,
}: {
  galleryId: string;
  images: ImageRow[];
  coverImageId: string | null;
  otherGalleries: GalleryOption[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingAltId, setEditingAltId] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState("");

  async function mutate(imageId: string, request: () => Promise<Response>): Promise<boolean> {
    setBusyId(imageId);
    try {
      const res = await request();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Operation failed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      alert("Network error. Please try again.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function saveAlt(imageId: string) {
    if (busyId === imageId) return; // Enter and blur can both fire for one edit
    const ok = await mutate(imageId, () =>
      fetch(`/api/admin/images/${imageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: altDraft }),
      }),
    );
    if (ok) setEditingAltId(null);
  }

  async function setCover(imageId: string) {
    await mutate(imageId, () =>
      fetch(`/api/admin/galleries/${galleryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImageId: imageId }),
      }),
    );
  }

  async function removeFromGallery(imageId: string) {
    if (!confirm("Remove this image from the gallery? It will move to Unsorted.")) return;
    await mutate(imageId, () =>
      fetch("/api/admin/images/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: [imageId], galleryId: null }),
      }),
    );
  }

  async function moveTo(imageId: string, targetGalleryId: string) {
    if (!targetGalleryId) return;
    await mutate(imageId, () =>
      fetch("/api/admin/images/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: [imageId], galleryId: targetGalleryId }),
      }),
    );
  }

  if (images.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No images in this gallery. Upload images from the Images page and assign them here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {images.map((img) => (
        <div key={img.id} className="relative group">
          <div className="aspect-square relative rounded overflow-hidden bg-gray-100">
            <Image
              src={img.thumbnailUrl}
              alt={img.altText ?? img.filename}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            />
            {coverImageId === img.id && (
              <span className="absolute top-1 left-1 text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded">
                Cover
              </span>
            )}
            {busyId === img.id && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center text-xs">
                …
              </div>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
            {coverImageId !== img.id && (
              <button onClick={() => setCover(img.id)} className="text-gray-600 hover:text-gray-900">
                Set cover
              </button>
            )}
            <button
              onClick={() => removeFromGallery(img.id)}
              className="text-gray-600 hover:text-red-600"
            >
              Remove
            </button>
            {editingAltId === img.id ? (
              <input
                autoFocus
                type="text"
                value={altDraft}
                onChange={(e) => setAltDraft(e.target.value)}
                onBlur={() => saveAlt(img.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveAlt(img.id);
                  if (e.key === "Escape") setEditingAltId(null);
                }}
                className="text-xs border border-gray-300 rounded px-1 py-0.5 w-full"
                placeholder="Alt text"
              />
            ) : (
              <button
                onClick={() => {
                  setAltDraft(img.altText ?? "");
                  setEditingAltId(img.id);
                }}
                className="text-gray-600 hover:text-gray-900 truncate text-left"
                title={img.altText ?? "No alt text"}
              >
                {img.altText ? "✎ alt" : "+ alt"}
              </button>
            )}
            {otherGalleries.length > 0 && (
              <select
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = "";
                  if (v) moveTo(img.id, v);
                }}
                defaultValue=""
                className="text-xs border border-gray-200 rounded px-1 py-0.5"
              >
                <option value="">Move to…</option>
                {otherGalleries.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
