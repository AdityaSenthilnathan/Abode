"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { submitRequestAction } from "@/actions/requests";

const input =
  "rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const description = String(fd.get("description") ?? "").trim();
    const urgency = String(fd.get("urgency") ?? "med");
    const files = fd.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);

    setBusy(true);
    setError(null);
    try {
      const mediaKeys: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setStatus(`Uploading ${i + 1}/${files.length}…`);
        mediaKeys.push(await uploadFile(files[i]));
      }
      setStatus("Submitting…");
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
      <label className="grid gap-1 text-sm">
        Photos / video (optional)
        <input type="file" name="media" multiple accept="image/*,video/*" className="text-sm" />
      </label>
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
