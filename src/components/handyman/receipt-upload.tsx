"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addReceiptAction } from "@/actions/handyman";

const input =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20";

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

export function ReceiptUpload({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    const description = String(fd.get("description") ?? "");
    const file = fd.get("file");
    setBusy(true);
    setErr(null);
    try {
      let fileUrl = "";
      if (file instanceof File && file.size > 0) fileUrl = await uploadFile(file);
      const r = await addReceiptAction({ taskId, fileUrl, amount, description });
      if ("error" in r) {
        setErr(r.error);
        return;
      }
      form.reset();
      router.refresh();
    } catch (er) {
      setErr((er as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <input name="amount" type="number" step="0.01" min="0" placeholder="Amount $" required className={`${input} w-28`} />
      <input name="description" placeholder="What for?" className={`${input} min-w-[10rem] flex-1`} />
      <input name="file" type="file" accept="image/*,application/pdf" className="text-xs" />
      {err && <p className="w-full text-sm text-red-600">{err}</p>}
      <button disabled={busy} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10">
        {busy ? "Adding…" : "Add receipt"}
      </button>
    </form>
  );
}
