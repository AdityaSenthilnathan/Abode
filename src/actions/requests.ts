"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/server/auth/guard";
import { createRequest } from "@/server/services/requests";

const schema = z.object({
  description: z.string().trim().min(3, "Please add a short description."),
  urgency: z.enum(["low", "med", "high", "urgent"]),
  mediaKeys: z.array(z.string()).max(10).default([]),
});

export async function submitRequestAction(
  input: unknown,
): Promise<{ ok: true } | { error: string }> {
  const user = await assertRole("tenant");
  const p = schema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  await createRequest(user.id, p.data);
  revalidatePath("/requests");
  // The new request (and the manager's notification) surface on the owner's
  // side too — clear their cached views so it shows without a hard reload.
  revalidatePath("/fix-it");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { ok: true };
}
