import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { asAdmin, withUser, type DbTx } from "@/server/db/rls";
import { emitEvent } from "@/server/realtime/emit";
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

export type Urgency = "low" | "med" | "high" | "urgent";
const URGENCY_RANK: Record<Urgency, number> = { low: 1, med: 2, high: 3, urgent: 4 };

export interface EmployeeMapProperty {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  urgency: Urgency | null;
  /** Unit the active request was reported on, e.g. "101". */
  unit: string | null;
  /** Id of this handyman's task here (for linking to the job page). */
  taskId: string | null;
  /** Owner's task title (the job), if one is assigned to this handyman here. */
  task: string | null;
  ownerName: string | null;
  /** The manager's note on the task. */
  ownerNote: string | null;
  tenantName: string | null;
  /** What the tenant reported. */
  tenantNote: string | null;
}

/**
 * Properties for the handyman map, enriched with the single most relevant
 * active maintenance request (highest urgency, then newest) and this
 * handyman's task at each property — so a pin's popup can show the job, the
 * urgency, and a personal note from the tenant or the manager.
 */
export function mapProperties(handymanId: string): Promise<EmployeeMapProperty[]> {
  return withUser(handymanId, async (tx) => {
    const props = await tx
      .select({
        id: properties.id,
        name: properties.name,
        address: properties.address,
        lat: properties.lat,
        lng: properties.lng,
        ownerName: users.fullName,
        ownerEmail: users.email,
      })
      .from(properties)
      .leftJoin(users, eq(users.id, properties.ownerId));

    const reqs = await tx
      .select({
        propertyId: units.propertyId,
        unitNumber: units.unitNumber,
        urgency: maintenanceRequests.urgency,
        status: maintenanceRequests.status,
        description: maintenanceRequests.description,
        createdAt: maintenanceRequests.createdAt,
        tenantName: users.fullName,
        tenantEmail: users.email,
      })
      .from(maintenanceRequests)
      .innerJoin(units, eq(units.id, maintenanceRequests.unitId))
      .leftJoin(users, eq(users.id, units.tenantId));

    const tks = await tx
      .select({
        id: tasks.id,
        propertyId: tasks.propertyId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(eq(tasks.assignedTo, handymanId));

    // Best active request per property: highest urgency, then most recent.
    const reqByProp = new Map<string, (typeof reqs)[number]>();
    for (const r of reqs) {
      if (r.status === "done") continue;
      const cur = reqByProp.get(r.propertyId);
      const better =
        !cur ||
        URGENCY_RANK[r.urgency] > URGENCY_RANK[cur.urgency] ||
        (URGENCY_RANK[r.urgency] === URGENCY_RANK[cur.urgency] && r.createdAt > cur.createdAt);
      if (better) reqByProp.set(r.propertyId, r);
    }

    // Best task per property: prefer active (not done), then most recent.
    const taskByProp = new Map<string, (typeof tks)[number]>();
    for (const t of tks) {
      const cur = taskByProp.get(t.propertyId);
      const tActive = t.status !== "done";
      const curActive = cur ? cur.status !== "done" : false;
      const better = !cur || (tActive && !curActive) || (tActive === curActive && t.createdAt > cur.createdAt);
      if (better) taskByProp.set(t.propertyId, t);
    }

    // Only map properties where this handyman still has active (non-done) work —
    // completed jobs shouldn't linger as pins.
    const activePropIds = new Set(tks.filter((t) => t.status !== "done").map((t) => t.propertyId));

    return props
      .filter((p) => p.lat != null && p.lng != null && activePropIds.has(p.id))
      .map((p) => {
        const r = reqByProp.get(p.id);
        const t = taskByProp.get(p.id);
        return {
          id: p.id,
          name: p.name,
          address: p.address,
          lat: Number(p.lat),
          lng: Number(p.lng),
          urgency: r?.urgency ?? null,
          unit: r?.unitNumber ?? null,
          taskId: t?.id ?? null,
          task: t?.title ?? null,
          ownerName: p.ownerName ?? p.ownerEmail ?? null,
          ownerNote: t?.description ?? null,
          tenantName: r?.tenantName ?? r?.tenantEmail ?? null,
          tenantNote: r?.description ?? null,
        };
      });
  });
}

/** Tasks assigned to this handyman, with property name, coords, and request urgency. */
export function listJobs(handymanId: string) {
  return withUser(handymanId, (tx) =>
    tx
      .select({
        task: tasks,
        propertyName: properties.name,
        propertyAddress: properties.address,
        lat: properties.lat,
        lng: properties.lng,
        urgency: maintenanceRequests.urgency,
      })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .leftJoin(maintenanceRequests, eq(maintenanceRequests.id, tasks.requestId))
      .where(eq(tasks.assignedTo, handymanId))
      .orderBy(desc(tasks.createdAt)),
  );
}

/** Full job detail: property, owner, originating request + tenant, receipts. */
export async function jobDetail(handymanId: string, taskId: string) {
  return withUser(handymanId, async (tx) => {
    // Task + its property + the property owner's name in one query (was three).
    const [row] = await tx
      .select({ task: tasks, property: properties, ownerName: users.fullName, ownerEmail: users.email })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .leftJoin(users, eq(users.id, properties.ownerId))
      .where(and(eq(tasks.id, taskId), eq(tasks.assignedTo, handymanId)))
      .limit(1);
    if (!row) return null;
    const { task, property } = row;
    const ownerName = row.ownerName ?? row.ownerEmail ?? null;

    let unitNumber: string | null = null;
    let tenantName: string | null = null;
    let requestDesc: string | null = null;
    let mediaUrls: string[] = [];
    if (task.requestId) {
      // Request + unit + tenant name in one query (was two).
      const [r] = await tx
        .select({
          req: maintenanceRequests,
          unitNumber: units.unitNumber,
          tenantName: users.fullName,
          tenantEmail: users.email,
        })
        .from(maintenanceRequests)
        .innerJoin(units, eq(units.id, maintenanceRequests.unitId))
        .leftJoin(users, eq(users.id, units.tenantId))
        .where(eq(maintenanceRequests.id, task.requestId))
        .limit(1);
      if (r) {
        unitNumber = r.unitNumber;
        requestDesc = r.req.description;
        mediaUrls = r.req.mediaUrls;
        tenantName = r.tenantName ?? r.tenantEmail ?? null;
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
    // Push both: the bell badge (notification) and the in-chat job-workflow bar
    // (job), so the owner's Approve/Accept buttons surface in <1s, no reload.
    await emitEvent(tx, { topic: "notification", recipients: [prop.ownerId], entityType: "task", entityId: taskId });
    await emitEvent(tx, { topic: "job", recipients: [prop.ownerId], taskId });
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
