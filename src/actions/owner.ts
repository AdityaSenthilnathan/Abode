"use server";
import { revalidatePath } from "next/cache";
import { assertRole, requireUser } from "@/server/auth/guard";
import { acceptCompletion, approveEstimate, assignTask } from "@/server/services/owner";
import { markNotificationRead } from "@/server/services/notifications";

export async function assignTaskAction(formData: FormData) {
  const owner = await assertRole("owner");
  const title = String(formData.get("title") ?? "").trim() || "Maintenance task";
  const propertyId = String(formData.get("propertyId") ?? "");
  const assignedTo = String(formData.get("assignedTo") ?? "");
  const requestId = formData.get("requestId") ? String(formData.get("requestId")) : undefined;
  const deadline = formData.get("deadline") ? String(formData.get("deadline")) : null;
  if (!propertyId || !assignedTo) return;
  await assignTask(owner.id, { title, propertyId, assignedTo, requestId, deadline });
  revalidatePath("/fix-it");
}

export async function markReadAction(formData: FormData) {
  const user = await requireUser();
  await markNotificationRead(user.id, String(formData.get("id")));
  revalidatePath("/notifications");
}

export async function approveEstimateAction(formData: FormData) {
  const owner = await assertRole("owner");
  await approveEstimate(owner.id, String(formData.get("taskId")));
  revalidatePath("/fix-it");
}

export async function acceptCompletionAction(formData: FormData) {
  const owner = await assertRole("owner");
  await acceptCompletion(owner.id, String(formData.get("taskId")));
  revalidatePath("/fix-it");
}
