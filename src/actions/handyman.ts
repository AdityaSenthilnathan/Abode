"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertRole } from "@/server/auth/guard";
import {
  acceptJob,
  addReceipt,
  declineJob,
  submitCompletion,
  submitEstimate,
} from "@/server/services/handyman";
import { ensureJobConversations, messageManagerForTask } from "@/server/services/messaging";

export async function openJobChatAction(formData: FormData) {
  const u = await assertRole("employee");
  const taskId = String(formData.get("taskId"));
  await ensureJobConversations(u.id, taskId);
  redirect(`/messages?job=${taskId}`);
}

export async function acceptJobAction(formData: FormData) {
  const u = await assertRole("employee");
  const taskId = String(formData.get("taskId"));
  await acceptJob(u.id, taskId);
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${taskId}`);
}

export async function declineJobAction(formData: FormData) {
  const u = await assertRole("employee");
  const taskId = String(formData.get("taskId"));
  await declineJob(u.id, taskId);
  revalidatePath("/jobs");
  // The job is no longer assigned to this handyman, so its detail page 404s —
  // send them back to the list whether they declined from the list or the detail.
  redirect("/jobs");
}

export async function submitEstimateAction(formData: FormData) {
  const u = await assertRole("employee");
  const taskId = String(formData.get("taskId"));
  const dollars = Number(formData.get("amount"));
  const message = String(formData.get("message") ?? "").trim();
  if (Number.isFinite(dollars) && dollars > 0) {
    await submitEstimate(u.id, taskId, Math.round(dollars * 100));
    if (message) await messageManagerForTask(u.id, taskId, message);
  }
  revalidatePath(`/jobs/${taskId}`);
}

export async function addReceiptAction(input: {
  taskId: string;
  fileUrl: string;
  amount: number;
  description?: string;
}): Promise<{ ok: true } | { error: string }> {
  const u = await assertRole("employee");
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { error: "Enter a valid amount." };
  await addReceipt(u.id, input.taskId, input.fileUrl, Math.round(input.amount * 100), input.description ?? null);
  revalidatePath(`/jobs/${input.taskId}`);
  return { ok: true };
}

export async function submitCompletionAction(formData: FormData): Promise<void> {
  const u = await assertRole("employee");
  const taskId = String(formData.get("taskId"));
  const dollars = Number(formData.get("finalCost"));
  if (!Number.isFinite(dollars) || dollars <= 0) return;
  try {
    await submitCompletion(u.id, taskId, Math.round(dollars * 100));
  } catch {
    // completion is gated in the UI (requires ≥1 receipt); ignore here
  }
  revalidatePath(`/jobs/${taskId}`);
}
