import "server-only";
import { desc, eq } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import { presignView } from "@/server/s3";
import { maintenanceRequests, tasks, units, users } from "@db/schema";

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i;

export type Urgency = "low" | "med" | "high" | "urgent";

/** Tenant files a maintenance request against their own unit (RLS-scoped). */
export async function createRequest(
  userId: string,
  input: { description: string; urgency: Urgency; mediaKeys: string[] },
) {
  return withUser(userId, async (tx) => {
    const [unit] = await tx.select().from(units).limit(1); // RLS → tenant's own unit
    if (!unit) throw new Error("No unit is assigned to your account yet.");
    const [req] = await tx
      .insert(maintenanceRequests)
      .values({
        unitId: unit.id,
        submittedBy: userId,
        description: input.description,
        urgency: input.urgency,
        mediaUrls: input.mediaKeys,
      })
      .returning();
    return req;
  });
}

export async function listMyRequests(userId: string) {
  return withUser(userId, (tx) =>
    tx.select().from(maintenanceRequests).orderBy(desc(maintenanceRequests.createdAt)),
  );
}

/**
 * One maintenance request the tenant filed, with the work it spawned: the latest
 * task's status, the assigned handyman's name, final cost when done, plus signed
 * URLs for the media the tenant uploaded.
 *
 * Ownership is enforced by RLS: the request select runs as the tenant (returns
 * nothing if it isn't theirs). The task/assignee lookup then runs via asAdmin
 * because tenants can't read `tasks`/other `users` under RLS — safe here since we
 * only reach it after confirming the request belongs to this tenant.
 */
export async function requestDetail(userId: string, requestId: string) {
  const request = await withUser(userId, async (tx) => {
    const [req] = await tx
      .select()
      .from(maintenanceRequests)
      .where(eq(maintenanceRequests.id, requestId))
      .limit(1);
    return req ?? null;
  });
  if (!request) return null;

  const work = await asAdmin(async (tx) => {
    const [row] = await tx
      .select({
        status: tasks.status,
        deadline: tasks.deadline,
        scheduledAt: tasks.scheduledAt,
        handymanName: users.fullName,
        handymanEmail: users.email,
      })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assignedTo))
      .where(eq(tasks.requestId, requestId))
      .orderBy(desc(tasks.createdAt))
      .limit(1);
    return row ?? null;
  });

  const media = await Promise.all(
    request.mediaUrls.map(async (key) => ({
      url: await presignView(key),
      isVideo: VIDEO_EXT.test(key),
    })),
  );

  return {
    request,
    task: work,
    handymanName: work ? (work.handymanName ?? work.handymanEmail) : null,
    media,
  };
}
