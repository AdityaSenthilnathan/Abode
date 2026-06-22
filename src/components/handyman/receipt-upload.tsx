"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Plus, X } from "lucide-react";
import { addReceiptAction } from "@/actions/handyman";

const field =
  "rounded-lg border border-line bg-background px-2.5 py-1.5 text-sm outline-none transition focus:border-brand";

async function uploadFile(file: File): Promise<string> {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: file.type, filename: file.name }),
  });
  if (!presign.ok) throw new Error("Couldn't prepare upload");
  const { url, key } = (await presign.json()) as { url: string; key: string };
  const put = await fetch(url, { method: "PUT", headers: { "content-type": file.type }, body: file });
  if (!put.ok) throw new Error("Upload failed");
  return key;
}

function prettySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReceiptUpload({ taskId }: { taskId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isImage = file?.type.startsWith("image/") ?? false;

  // Build/tear down the object URL for the image thumbnail.
  useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  function clearFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    const description = String(fd.get("description") ?? "");
    setBusy(true);
    setErr(null);
    try {
      let fileUrl = "";
      if (file && file.size > 0) fileUrl = await uploadFile(file);
      const r = await addReceiptAction({ taskId, fileUrl, amount, description });
      if ("error" in r) {
        setErr(r.error);
        return;
      }
      form.reset();
      clearFile();
      router.refresh();
    } catch (er) {
      setErr((er as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5">
      {/* chosen-file preview */}
      {file && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2">
          {isImage && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={file.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-background text-muted">
              <FileText className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{file.name}</div>
            <div className="text-xs text-muted">{prettySize(file.size)}</div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Remove file"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-background hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* input row */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Attach a photo or PDF"
          aria-label="Attach a photo or PDF"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-brand/50 hover:text-brand"
        >
          <Paperclip className="h-[18px] w-[18px]" />
        </button>

        <div className="flex items-center rounded-lg border border-line bg-background pl-2.5 transition focus-within:border-brand">
          <span className="text-sm text-muted">$</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount"
            required
            className="w-24 bg-transparent px-1.5 py-1.5 text-sm outline-none"
          />
        </div>

        <input name="description" placeholder="What for?" className={`${field} min-w-[8rem] flex-1`} />

        <button
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {busy ? "Adding…" : "Add receipt"}
        </button>
      </div>

      <input
        ref={fileRef}
        name="file"
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
    </form>
  );
}
