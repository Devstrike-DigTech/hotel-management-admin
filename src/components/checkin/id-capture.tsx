"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, FilePdf, IdentificationCard, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/button";

export type IdCaptureState =
  | { status: "empty" }
  | { status: "ready"; file: Blob; name: string; preview: string | null }
  | { status: "uploading"; file: Blob; name: string; preview: string | null }
  | { status: "uploaded"; preview: string | null; name: string }
  | { status: "error"; file: Blob; name: string; preview: string | null; message: string };

/** Downscale camera photos before upload: Lagos data is expensive and 12MP IDs are overkill. */
export async function shrinkImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * The "affix ID here" box on the register card. Take a photo (opens the rear
 * camera on phones via capture="environment") or upload an image / PDF.
 */
export function IdCapture({
  state,
  onFile,
  hasExisting,
  disabled,
}: {
  state: IdCaptureState;
  onFile: (file: Blob, name: string, preview: string | null) => void;
  hasExisting?: boolean;
  disabled?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const preview = state.status !== "empty" ? state.preview : null;

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const blob = await shrinkImage(f);
    setBusy(false);
    onFile(blob, f.type === "application/pdf" ? f.name : f.name.replace(/\.\w+$/, ".jpg"), f.type.startsWith("image/") ? URL.createObjectURL(blob) : null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "relative grid aspect-[1.586] w-full place-items-center overflow-hidden rounded-[3px] border-[1.5px] border-dashed",
          state.status === "error" ? "border-danger" : state.status === "uploaded" ? "border-palm" : "border-line-strong",
          "bg-[repeating-linear-gradient(-45deg,transparent_0_7px,color-mix(in_oklab,var(--line)_45%,transparent)_7px_8px)]",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="Captured ID" className="absolute inset-0 h-full w-full object-cover" />
        ) : state.status !== "empty" ? (
          <span className="flex flex-col items-center gap-1 text-ink-muted">
            <FilePdf size={30} weight="duotone" />
            <span className="max-w-[90%] truncate text-[11.5px]">{state.name}</span>
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-3 text-center text-ink-faint">
            <IdentificationCard size={30} weight="thin" />
            <span className="card-label text-[9px]">{hasExisting ? "ID on file. Replace?" : "Affix ID here"}</span>
          </span>
        )}
        {(busy || state.status === "uploading") && (
          <span className="absolute inset-0 grid place-items-center bg-[color-mix(in_oklab,var(--surface)_70%,transparent)]">
            <Spinner size={20} className="text-laterite" />
          </span>
        )}
        {state.status === "uploaded" && (
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-palm px-2 py-0.5 text-[10.5px] font-medium text-paper">
            <CheckCircle size={11} weight="bold" /> saved
          </span>
        )}
      </div>
      {state.status === "error" && (
        <p className="flex items-center gap-1 text-[11.5px] text-danger">
          <WarningCircle size={12} /> {state.message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => camera.current?.click()}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border border-line-strong bg-surface text-[12px] font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
        >
          <Camera size={14} weight="duotone" /> Photo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => upload.current?.click()}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border border-line-strong bg-surface text-[12px] font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
        >
          <UploadSimple size={14} weight="duotone" /> Upload
        </button>
      </div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label="Take a photo of the ID"
        data-testid="id-camera"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={upload}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload the ID"
        data-testid="id-upload"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
