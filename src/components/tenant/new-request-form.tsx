"use client";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { submitRequestAction } from "@/actions/requests";

const input =
  "rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

const MAX_FILES = 10;

type Item = { file: File; url: string; isImage: boolean };

async function uploadFile(file: File): Promise<string> {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: file.type, filename: file.name }),
  });
  if (!presign.ok) throw new Error(`Couldn't prepare upload for ${file.name}`);
  const { url, key } = (await presign.json()) as { url: string; key: string };
  const put = await fetch(url, { method: "PUT", headers: { "content-type": file.type }, body: file });
  if (!put.ok) throw new Error(`Upload failed for ${file.name}`);
  return key;
}

export function NewRequestForm() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  // Revoke any outstanding object URLs when the form unmounts (no state writes).
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setNotice(null);
    setItems((cur) => {
      const next = [...cur];
      for (const file of Array.from(list)) {
        if (file.size === 0) continue;
        if (!/^(image|video)\//.test(file.type)) {
          setNotice("Only photos and videos can be attached.");
          continue;
        }
        if (next.some((i) => i.file.name === file.name && i.file.size === file.size)) continue;
        if (next.length >= MAX_FILES) {
          setNotice(`You can attach up to ${MAX_FILES} files.`);
          break;
        }
        next.push({ file, url: URL.createObjectURL(file), isImage: file.type.startsWith("image/") });
      }
      return next;
    });
  }

  function removeAt(idx: number) {
    setItems((cur) => {
      const target = cur[idx];
      if (target) URL.revokeObjectURL(target.url);
      return cur.filter((_, i) => i !== idx);
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const description = String(fd.get("description") ?? "").trim();
    const urgency = String(fd.get("urgency") ?? "med");

    setBusy(true);
    setError(null);
    try {
      const mediaKeys: string[] = [];
      for (let i = 0; i < items.length; i++) {
        setStatus(`Uploading ${i + 1}/${items.length} — ${items[i].file.name}…`);
        mediaKeys.push(await uploadFile(items[i].file));
      }
      setStatus(items.length ? "Saving your request…" : "Submitting…");
      const r = await submitRequestAction({ description, urgency, mediaKeys });
      if ("error" in r) {
        setError(r.error);
        setBusy(false);
        setStatus(null);
        return;
      }
      router.push("/requests");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="grid gap-1 text-sm">
        Description
        <textarea name="description" required rows={4} placeholder="What's wrong?" className={input} />
      </label>
      <label className="grid gap-1 text-sm">
        Urgency
        <select name="urgency" defaultValue="med" className={input}>
          <option value="low">Low</option>
          <option value="med">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>

      <div className="grid gap-2 text-sm">
        <span>Photos / video (optional)</span>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
            dragOver
              ? "border-black/50 bg-black/5 dark:border-white/60 dark:bg-white/10"
              : "border-black/20 hover:bg-black/[0.03] dark:border-white/25 dark:hover:bg-white/5"
          }`}
        >
          <span className="text-sm font-medium">Drag &amp; drop, or click to choose</span>
          <span className="mt-1 text-xs opacity-60">Up to {MAX_FILES} photos or videos</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((it, i) => (
              <div
                key={`${it.file.name}-${it.file.size}`}
                className="group relative aspect-square overflow-hidden rounded-lg border border-black/10 dark:border-white/15"
              >
                {it.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt={it.file.name} className="h-full w-full object-cover" />
                ) : (
                  <video src={it.url} muted className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove ${it.file.name}`}
                  className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs leading-5 text-white hover:bg-black"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {notice && <p className="text-xs text-amber-600 dark:text-amber-400">{notice}</p>}
      </div>

      {status && <p className="text-sm opacity-60">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={busy}
        className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
      >
        {busy ? "Working…" : "Submit request"}
      </button>
    </form>
  );
}
