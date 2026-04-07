"use client";

import { useState, useRef, useCallback, type DragEvent } from "react";
import { useRouter } from "next/navigation";

type UploadState = {
  id: string;
  filename: string;
  status: "pending" | "uploading" | "registering" | "done" | "error";
  error?: string;
};

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
]);

const SIZE_WARNING_BYTES = 20 * 1024 * 1024;

export default function ImageUploader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    async (files: File[]) => {
      const validFiles: File[] = [];
      const rejectedUploads: UploadState[] = [];

      for (const f of files) {
        if (!ACCEPTED_TYPES.has(f.type)) {
          rejectedUploads.push({
            id: crypto.randomUUID(),
            filename: f.name,
            status: "error",
            error: "Unsupported file type",
          });
        } else {
          validFiles.push(f);
        }
      }

      if (validFiles.length === 0 && rejectedUploads.length === 0) return;

      // Warn about large files
      const largeFiles = validFiles.filter(
        (f) => f.size > SIZE_WARNING_BYTES,
      );
      if (largeFiles.length > 0) {
        const names = largeFiles.map((f) => f.name).join(", ");
        const ok = window.confirm(
          `The following files are over 20MB and may take a while to upload:\n\n${names}\n\nContinue?`,
        );
        if (!ok) return;
      }

      const newUploads: UploadState[] = validFiles.map((f) => ({
        id: crypto.randomUUID(),
        filename: f.name,
        status: "pending",
      }));

      setUploads((prev) => [...prev, ...rejectedUploads, ...newUploads]);

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const uploadId = newUploads[i].id;

        const update = (patch: Partial<UploadState>) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadId ? { ...u, ...patch } : u)),
          );
        };

        try {
          update({ status: "uploading" });
          const presignRes = await fetch("/api/admin/images/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
            }),
          });

          if (!presignRes.ok) {
            const data = await presignRes.json();
            update({ status: "error", error: data.error ?? "Presign failed" });
            continue;
          }

          const { uploadUrl, imageId, s3Key, ext } = await presignRes.json();

          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!uploadRes.ok) {
            update({ status: "error", error: "S3 upload failed" });
            continue;
          }

          update({ status: "registering" });
          const registerRes = await fetch("/api/admin/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageId, s3Key, ext, filename: file.name }),
          });

          if (!registerRes.ok) {
            const data = await registerRes.json();
            update({
              status: "error",
              error: data.error ?? "Registration failed",
            });
            continue;
          }

          update({ status: "done" });
        } catch {
          update({ status: "error", error: "Network error" });
        }
      }

      router.refresh();
    },
    [router],
  );

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }

  function handleFileSelect() {
    const files = fileInputRef.current?.files;
    if (files) processFiles(Array.from(files));
  }

  const activeUploads = uploads.filter(
    (u) => u.status !== "done" && u.status !== "error",
  );
  const hasActive = activeUploads.length > 0;

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-gray-900 bg-gray-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <p className="text-sm text-gray-600">
          Drop images here or click to select
        </p>
        <p className="text-xs text-gray-400 mt-1">
          JPEG, PNG, WebP, TIFF accepted
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/tiff"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-1">
          {hasActive && (
            <p className="text-xs text-gray-500 mb-2">
              Uploading {activeUploads.length} file
              {activeUploads.length === 1 ? "" : "s"}...
            </p>
          )}
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between text-xs py-1"
            >
              <span className="text-gray-700 truncate mr-2">{u.filename}</span>
              <span
                className={
                  u.status === "done"
                    ? "text-green-600"
                    : u.status === "error"
                      ? "text-red-600"
                      : "text-gray-400"
                }
              >
                {u.status === "pending" && "Waiting"}
                {u.status === "uploading" && "Uploading..."}
                {u.status === "registering" && "Processing..."}
                {u.status === "done" && "Done"}
                {u.status === "error" && (u.error ?? "Error")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
