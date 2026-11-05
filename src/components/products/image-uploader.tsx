"use client";

import * as React from "react";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { ProductImage } from "@shared/types";
import { firebase, IMAGE_STORAGE } from "@/lib/firebase/client";
import { newRequestId } from "@/lib/format";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGES = 6;

interface Uploading {
  id: string;
  name: string;
  progress: number;
}

function uploadToFirebase(path: string, file: File, onProgress: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(firebase().storage, path), file, { contentType: file.type });
    task.on("state_changed", (s) => onProgress(s.bytesTransferred / s.totalBytes), reject, () => getDownloadURL(task.snapshot.ref).then(resolve, reject));
  });
}

/** Uploads straight from the browser to Vercel Blob with a short-lived token issued by /api/uploads. */
async function uploadToBlob(path: string, file: File, onProgress: (p: number) => void): Promise<string> {
  const { upload } = await import("@vercel/blob/client");
  const idToken = await firebase().auth.currentUser?.getIdToken();
  const result = await upload(path, file, {
    access: "public",
    contentType: file.type,
    handleUploadUrl: "/api/uploads",
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
    onUploadProgress: (e) => onProgress(e.percentage / 100),
  });
  return result.url;
}

export function ImageUploader({
  farmerId,
  value,
  onChange,
}: {
  farmerId: string;
  value: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}) {
  const [uploading, setUploading] = React.useState<Uploading[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const room = MAX_IMAGES - value.length - uploading.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > list.length) setError(`You can add up to ${MAX_IMAGES} images.`);
    for (const file of list) {
      if (!TYPES.includes(file.type)) {
        setError(`${file.name}: only JPEG, PNG or WebP images are allowed.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: images must be smaller than 5 MB.`);
        continue;
      }
      const id = newRequestId();
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-60);
      const path = `products/${farmerId}/${id}/${safeName}`;
      setUploading((u) => [...u, { id, name: file.name, progress: 0 }]);
      const onProgress = (p: number) => setUploading((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x)));
      (IMAGE_STORAGE === "blob" ? uploadToBlob(path, file, onProgress) : uploadToFirebase(path, file, onProgress)).then(
        (url) => {
          setUploading((u) => u.filter((x) => x.id !== id));
          onChange([...valueRef.current, { path, url }]);
        },
        () => {
          setUploading((u) => u.filter((x) => x.id !== id));
          setError(`${file.name} could not be uploaded. Check your connection and try again.`);
        },
      );
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (img: ProductImage) => {
    onChange(value.filter((v) => v.path !== img.path));
    // Best effort; an orphaned file is harmless and cannot be referenced by anyone else's listing.
    if (IMAGE_STORAGE === "firebase") deleteObject(ref(firebase().storage, img.path)).catch(() => undefined);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {value.map((img, i) => (
          <div key={img.path} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- user uploads */}
            <img src={img.url} alt={`Product image ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">Cover</span>}
            <button
              type="button"
              onClick={() => remove(img)}
              className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label={`Remove image ${i + 1}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {uploading.map((u) => (
          <div key={u.id} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            {Math.round(u.progress * 100)}%
          </div>
        ))}
        {value.length + uploading.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <ImagePlus className="size-5" />
            Add photo
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={TYPES.join(",")} multiple className="sr-only" onChange={(e) => handleFiles(e.target.files)} aria-label="Upload product images" />
      <p className="text-xs text-muted-foreground">Up to {MAX_IMAGES} photos, JPEG, PNG or WebP, 5 MB each. The first photo is the cover.</p>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {uploading.length > 0 && <p className="sr-only" aria-live="polite">Uploading {uploading.length} image(s)</p>}
    </div>
  );
}
