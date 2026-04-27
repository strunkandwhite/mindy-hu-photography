"use client";

import { useState } from "react";
import Image from "next/image";

export function AboutImageUploader({
  initialUrl,
  onChange,
  label = "About Image",
}: {
  initialUrl: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const presignRes = await fetch("/api/admin/settings/about-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error("Could not get upload URL");
      const { uploadUrl, cdnUrl } = await presignRes.json();

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");

      setPreview(cdnUrl);
      onChange(cdnUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      {preview && (
        <div className="mb-2 relative w-32 aspect-[3/4] bg-gray-100 overflow-hidden rounded">
          <Image src={preview} alt="About" fill className="object-cover" sizes="128px" />
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="text-sm"
      />
      {preview && (
        <button
          type="button"
          onClick={() => {
            setPreview(null);
            onChange(null);
          }}
          className="ml-3 text-xs text-gray-500 hover:text-red-600"
        >
          Remove
        </button>
      )}
      {uploading && <p className="text-xs text-gray-500 mt-1">Uploading…</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
