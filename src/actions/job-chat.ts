"use server";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/server/auth/guard";
import { acceptJob, declineJob, submitCompletion, submitEstimate } from "@/server/services/handyman";
import { acceptCompletion, approveEstimate } from "@/server/services/owner";

/**
 * Workflow actions invoked from inside the owner↔handyman chat. Each mirrors the
 * job-page action but revalidates the conversation so the in-chat action bar
 * advances to the next step. Roles are re-checked in the underlying services.
 */

function revalidate(conversationId: string) {
  revalidatePath(`/messages/${conversationId}`);
}

export async function chatAcceptJobAction(formData: FormData) {
  const u = await assertRole("employee");
  await acceptJob(u.id, String(formData.get("taskId")));
  revalidate(String(formData.get("conversationId")));
}

export async function chatDeclineJobAction(formData: FormData) {
  const u = await assertRole("employee");
  await declineJob(u.id, String(formData.get("taskId")));
  revalidate(String(formData.get("conversationId")));
}

export async function chatSubmitEstimateAction(formData: FormData) {
  const u = await assertRole("employee");
  const dollars = Number(formData.get("amount"));
  if (Number.isFinite(dollars) && dollars > 0) {
    await submitEstimate(u.id, String(formData.get("taskId")), Math.round(dollars * 100));
  }
  revalidate(String(formData.get("conversationId")));
}

export async function chatSubmitCompletionAction(formData: FormData) {
  const u = await assertRole("employee");
  const dollars = Number(formData.get("finalCost"));
  if (Number.isFinite(dollars) && dollars > 0) {
    try {
      await submitCompletion(u.id, String(formData.get("taskId")), Math.round(dollars * 100));
    } catch {
      // gated on ≥1 receipt in the UI; ignore here
    }
  }
  revalidate(String(formData.get("conversationId")));
}

export async function chatApproveEstimateAction(formData: FormData) {
  const u = await assertRole("owner");
  await approveEstimate(u.id, String(formData.get("taskId")));
  revalidate(String(formData.get("conversationId")));
}

export async function chatAcceptCompletionAction(formData: FormData) {
  const u = await assertRole("owner");
  await acceptCompletion(u.id, String(formData.get("taskId")));
  revalidate(String(formData.get("conversationId")));
}
