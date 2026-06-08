import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { asAdmin, withUser, type DbTx } from "@/server/db/rls";
import {
  maintenanceRequests,
  notifications,
  properties,
  propertyEmployees,
  taskReceipts,
  tasks,
  units,
  users,
} from "@db/schema";

/** Tasks assigned to this handyman, with property name. */
export function listJobs(handymanId: string) {
  return withUser(handymanId, (tx) =>
    tx
      .select({ task: tasks, propertyName: properties.name, propertyAddress: properties.address })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .where(eq(tasks.assignedTo, handymanId))
      .orderBy(desc(tasks.createdAt)),
  );
}

/** Full job detail: property, owner, originating request + tenant, receipts. */
export async function jobDetail(handymanId: string, taskId: string) {
  return withUser(handymanId, async (tx) => {
    const [task] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.assignedTo, handymanId)))
      .limit(1);
    if (!task) return null;

    const [property] = await tx.select().from(properties).where(eq(properties.id, task.propertyId)).limit(1);
    let ownerName: string | null = null;
    if (property) {
      const [o] = await tx
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, property.ownerId))
        .limit(1);
      ownerName = o?.fullName ?? o?.email ?? null;
    }

    let unitNumber: string | null = null;
    let tenantName: string | null = null;
    let requestDesc: string | null = null;
    let mediaUrls: string[] = [];
    if (task.requestId) {
      const [r] = await tx
        .select({ req: maintenanceRequests, unitNumber: units.unitNumber, tenantId: units.tenantId })
        .from(maintenanceRequests)
        .innerJoin(units, eq(units.id, maintenanceRequests.unitId))
        .where(eq(maintenanceRequests.id, task.requestId))
        .limit(1);
      if (r) {
        unitNumber = r.unitNumber;
        requestDesc = r.req.description;
        mediaUrls = r.req.mediaUrls;
        if (r.tenantId) {
          const [t] = await tx
            .select({ fullName: users.fullName, email: users.email })
            .from(users)
            .where(eq(users.id, r.tenantId))
            .limit(1);
          tenantName = t?.fullName ?? t?.email ?? null;
        }
      }
    }

    const receipts = await tx
      .select()
      .from(taskReceipts)
      .where(eq(taskReceipts.taskId, taskId))
      .orderBy(desc(taskReceipts.uploadedAt));

    return { task, property, ownerName, unitNumber, tenantName, requestDesc, mediaUrls, receipts };
  });
}

// ---- mutations (trusted; verify the task is this handyman's) ------------------

async function notifyOwner(tx: DbTx, propertyId: string, title: string, body: string, taskId: string) {
  const [prop] = await tx.select({ ownerId: properties.ownerId }).from(properties).where(eq(properties.id, propertyId)).limit(1);
  if (prop) {
    await tx.insert(notifications).values({
      recipientId: prop.ownerId,
      type: "info",
      title,
      body,
      entityType: "task",
      entityId: taskId,
    });
  }
}

async function ownTask(tx: DbTx, taskId: string, handymanId: string) {
  const [t] = await tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.assignedTo, handymanId)))
    .limit(1);
  if (!t) throw new Error("Job not found");
  return t;
}

export function acceptJob(handymanId: string, taskId: string) {
  return asAdmin(async (tx) => {
    const t = await ownTask(tx, taskId, handymanId);
    await tx.update(tasks).set({ status: "accepted" }).where(eq(tasks.id, taskId));
    await notifyOwner(tx, t.propertyId, "Job accepted", t.title ?? "", taskId);
  });
}

export function declineJob(handymanId: string, taskId: string) {
  return asAdmin(async (tx) => {
    const t = await ownTask(tx, taskId, handymanId);
    await tx.update(tasks).set({ assignedTo: null, status: "open" }).where(eq(tasks.id, taskId));
    await tx
      .update(propertyEmployees)
      .set({ jobCount: sql`greatest(${propertyEmployees.jobCount} - 1, 0)` })
      .where(and(eq(propertyEmployees.propertyId, t.propertyId), eq(propertyEmployees.employeeId, handymanId)));
    await notifyOwner(tx, t.propertyId, "Job declined", `${t.title ?? "A job"} needs reassignment`, taskId);
  });
}

export function submitEstimate(handymanId: string, taskId: string, estimateCents: number) {
  return asAdmin(async (tx) => {
    const t = await ownTask(tx, taskId, handymanId);
    await tx.update(tasks).set({ estimateCents, estimateApprovedAt: null }).where(eq(tasks.id, taskId));
    await notifyOwner(tx, t.propertyId, "Estimate submitted", `$${(estimateCents / 100).toFixed(2)} for ${t.title ?? "a job"}`, taskId);
  });
}

export function addReceipt(handymanId: string, taskId: string, fileUrl: string, amountCents: number, description: string | null) {
  return asAdmin(async (tx) => {
    await ownTask(tx, taskId, handymanId);
    await tx.insert(taskReceipts).values({ taskId, fileUrl, amountCents, description });
  });
}

export function submitCompletion(handymanId: string, taskId: string, finalCostCents: number) {
  return asAdmin(async (tx) => {
    const t = await ownTask(tx, taskId, handymanId);
    const receipts = await tx.select({ id: taskReceipts.id }).from(taskReceipts).where(eq(taskReceipts.taskId, taskId));
    if (receipts.length === 0) throw new Error("Add at least one receipt before completing.");
    await tx.update(tasks).set({ finalCostCents }).where(eq(tasks.id, taskId));
    await notifyOwner(tx, t.propertyId, "Completion submitted", `Final cost $${(finalCostCents / 100).toFixed(2)} for ${t.title ?? "a job"}`, taskId);
  });
}
