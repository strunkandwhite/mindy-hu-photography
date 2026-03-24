"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type GalleryData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublished: number;
};

export default function GalleryForm({
  gallery,
}: {
  gallery?: GalleryData;
}) {
  const router = useRouter();
  const isEdit = !!gallery;

  const [title, setTitle] = useState(gallery?.title ?? "");
  const [slug, setSlug] = useState(gallery?.slug ?? "");
  const [description, setDescription] = useState(gallery?.description ?? "");
  const [isPublished, setIsPublished] = useState(
    gallery?.isPublished === 1,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      title,
      description: description || null,
    };

    if (isEdit) {
      body.slug = slug;
      body.isPublished = isPublished ? 1 : 0;
    }

    const url = isEdit
      ? `/api/admin/galleries/${gallery.id}`
      : "/api/admin/galleries";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        setSaving(false);
        return;
      }

      router.push("/admin/galleries");
      router.refresh();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm text-gray-700 mb-1">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      {isEdit && (
        <div>
          <label htmlFor="slug" className="block text-sm text-gray-700 mb-1">
            Slug
          </label>
          <input
            id="slug"
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="description"
          className="block text-sm text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="rounded border-gray-300"
          />
          Published
        </label>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Gallery"}
      </button>
    </form>
  );
}
