import "server-only";
import { and, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import { emitEvent } from "@/server/realtime/emit";
import {
  conversations,
  invoices,
  maintenanceRequests,
  notifications,
  properties,
  propertyEmployees,
  tasks,
  units,
  users,
} from "@db/schema";

/** Apartment grid: owner's units (RLS-scoped) with tenant name + open-request count, high→low. */
export async function ownerGrid(ownerId: string) {
  return withUser(ownerId, async (tx) => {
    const us = await tx.select().from(units);
    if (us.length === 0) return [];

    // Batch what used to be two queries *per unit* (tenant name + open-request
    // count) into one query each — avoids the N+1 round-trips that dominated
    // the owner dashboard's load time.
    const tenantIds = [...new Set(us.map((u) => u.tenantId).filter((id): id is string => !!id))];
    const unitIds = us.map((u) => u.id);

    const tenantRows = tenantIds.length
      ? await tx
          .select({ id: users.id, fullName: users.fullName, email: users.email })
          .from(users)
          .where(inArray(users.id, tenantIds))
      : [];
    const openRows = await tx
      .select({ unitId: maintenanceRequests.unitId, n: count() })
      .from(maintenanceRequests)
      .where(and(inArray(maintenanceRequests.unitId, unitIds), ne(maintenanceRequests.status, "done")))
      .groupBy(maintenanceRequests.unitId);

    const nameById = new Map(tenantRows.map((t) => [t.id, t.fullName ?? t.email ?? null] as const));
    const openById = new Map(openRows.map((o) => [o.unitId, Number(o.n)] as const));

    return us
      .map((u) => ({
        unit: u,
        tenantName: u.tenantId ? nameById.get(u.tenantId) ?? null : null,
        openRequests: openById.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.unit.unitNumber.localeCompare(a.unit.unitNumber, undefined, { numeric: true }));
  });
}

/** Headline dashboard metrics (all RLS-scoped to this owner). */
export async function ownerStats(ownerId: string) {
  return withUser(ownerId, async (tx) => {
    // Collapse the five single-metric queries into three by computing both
    // invoice metrics in one pass and both task metrics in another with FILTER.
    // (Queries in one transaction share a connection and run serially, so fewer
    // statements = fewer round-trips.)
    const [inv] = await tx
      .select({
        revenue: sql<number>`coalesce(sum(${invoices.amountCents}) filter (where ${invoices.status} = 'paid'), 0)`,
        unpaid: sql<number>`count(*) filter (where ${invoices.status} in ('unpaid', 'late'))`,
      })
      .from(invoices);
    const [tk] = await tx
      .select({
        expenses: sql<number>`coalesce(sum(${tasks.finalCostCents}) filter (where ${tasks.status} = 'done'), 0)`,
      })
      .from(tasks);
    // "Open fixes" = unresolved maintenance requests (received or in-progress),
    // matching the per-property "open fixes" the dashboard cards and map show —
    // not the task count, which would disagree with them.
    const [mr] = await tx
      .select({ openFixes: count() })
      .from(maintenanceRequests)
      .where(ne(maintenanceRequests.status, "done"));
    const [emp] = await tx.select({ n: count() }).from(propertyEmployees);
    return {
      revenueCents: Number(inv?.revenue ?? 0),
      unpaidCount: Number(inv?.unpaid ?? 0),
      openFixes: Number(mr?.openFixes ?? 0),
      expensesCents: Number(tk?.expenses ?? 0),
      employeeCount: Number(emp?.n ?? 0),
    };
  });
}

export type PortfolioUnit = {
  id: string;
  unitNumber: string;
  rentAmountCents: number | null;
  status: string;
  tenantName: string | null;
  openRequests: number;
  unpaidCount: number;
};

export type PortfolioProperty = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  units: PortfolioUnit[];
  occupied: number;
  vacant: number;
  monthlyRentCents: number;
  openRequests: number;
  unpaidCount: number;
};

/** The owner's whole portfolio: properties → their units, each enriched with the
 *  tenant, open-fix count, and unpaid-invoice count, plus per-property rollups +
 *  map coordinates. Powers the dashboard and the Properties page. RLS-scoped. */
export async function ownerPortfolio(ownerId: string): Promise<PortfolioProperty[]> {
  return withUser(ownerId, async (tx) => {
    const props = await tx.select().from(properties).orderBy(properties.name);
    if (props.length === 0) return [];

    const us = await tx.select().from(units);
    const tenantIds = [...new Set(us.map((u) => u.tenantId).filter((id): id is string => !!id))];
    const unitIds = us.map((u) => u.id);

    // One batched query each for tenant names, open fixes, and unpaid invoices —
    // same N+1-avoidance as ownerGrid, joined up per property below.
    const tenantRows = tenantIds.length
      ? await tx
          .select({ id: users.id, fullName: users.fullName, email: users.email })
          .from(users)
          .where(inArray(users.id, tenantIds))
      : [];
    const openRows = unitIds.length
      ? await tx
          .select({ unitId: maintenanceRequests.unitId, n: count() })
          .from(maintenanceRequests)
          .where(and(inArray(maintenanceRequests.unitId, unitIds), ne(maintenanceRequests.status, "done")))
          .groupBy(maintenanceRequests.unitId)
      : [];
    const unpaidRows = unitIds.length
      ? await tx
          .select({ unitId: invoices.unitId, n: count() })
          .from(invoices)
          .where(and(inArray(invoices.unitId, unitIds), inArray(invoices.status, ["unpaid", "late"])))
          .groupBy(invoices.unitId)
      : [];

    const nameById = new Map(tenantRows.map((t) => [t.id, t.fullName ?? t.email ?? null] as const));
    const openById = new Map(openRows.map((o) => [o.unitId, Number(o.n)] as const));
    const unpaidById = new Map(unpaidRows.map((o) => [o.unitId, Number(o.n)] as const));

    const byProp = new Map<string, PortfolioUnit[]>();
    for (const u of us) {
      const list = byProp.get(u.propertyId) ?? [];
      list.push({
        id: u.id,
        unitNumber: u.unitNumber,
        rentAmountCents: u.rentAmountCents,
        status: u.status,
        tenantName: u.tenantId ? nameById.get(u.tenantId) ?? null : null,
        openRequests: openById.get(u.id) ?? 0,
        unpaidCount: unpaidById.get(u.id) ?? 0,
      });
      byProp.set(u.propertyId, list);
    }

    return props.map((p) => {
      const unitList = (byProp.get(p.id) ?? []).sort((a, b) =>
        a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
      );
      const occupied = unitList.filter((u) => u.status === "occupied").length;
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        lat: p.lat != null ? Number(p.lat) : null,
        lng: p.lng != null ? Number(p.lng) : null,
        units: unitList,
        occupied,
        vacant: unitList.length - occupied,
        monthlyRentCents: unitList.reduce(
          (s, u) => s + (u.status === "occupied" ? u.rentAmountCents ?? 0 : 0),
          0,
        ),
        openRequests: unitList.reduce((s, u) => s + u.openRequests, 0),
        unpaidCount: unitList.reduce((s, u) => s + u.unpaidCount, 0),
      };
    });
  });
}

export type OwnerNotification = typeof notifications.$inferSelect & {
  propertyId: string | null;
  propertyName: string | null;
  unitNumber: string | null;
};

/** The owner's notifications, each tagged with the property (and unit, for
 *  request notifications) it concerns — so the Notifications page can filter by
 *  property. RLS-scoped: only entities on the owner's properties resolve. */
export async function ownerNotifications(ownerId: string): Promise<OwnerNotification[]> {
  return withUser(ownerId, async (tx) => {
    const notifs = await tx.select().from(notifications).orderBy(desc(notifications.createdAt));

    const taskRows = await tx
      .select({ id: tasks.id, propertyId: properties.id, propertyName: properties.name })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId));
    const reqRows = await tx
      .select({
        id: maintenanceRequests.id,
        unitNumber: units.unitNumber,
        propertyId: properties.id,
        propertyName: properties.name,
      })
      .from(maintenanceRequests)
      .innerJoin(units, eq(units.id, maintenanceRequests.unitId))
      .innerJoin(properties, eq(properties.id, units.propertyId));

    const taskMap = new Map(taskRows.map((t) => [t.id, t] as const));
    const reqMap = new Map(reqRows.map((r) => [r.id, r] as const));

    return notifs.map((n) => {
      let propertyId: string | null = null;
      let propertyName: string | null = null;
      let unitNumber: string | null = null;
      if (n.entityType === "task" && n.entityId) {
        const t = taskMap.get(n.entityId);
        if (t) ({ propertyId, propertyName } = t);
      } else if (n.entityType === "request" && n.entityId) {
        const r = reqMap.get(n.entityId);
        if (r) ({ propertyId, propertyName, unitNumber } = r);
      }
      return { ...n, propertyId, propertyName, unitNumber };
    });
  });
}

/** Just the owner's properties (id + name) — for filter chips etc. RLS-scoped. */
export async function ownerPropertyOptions(ownerId: string): Promise<{ id: string; name: string }[]> {
  return withUser(ownerId, (tx) =>
    tx.select({ id: properties.id, name: properties.name }).from(properties).orderBy(properties.name),
  );
}

export type OutstandingInvoice = {
  id: string;
  type: string;
  amountCents: number;
  dueDate: string;
  status: string;
  unitNumber: string;
  propertyName: string;
  tenantName: string | null;
};

/** Unpaid / late invoices across the owner's units — the owner-facing "who owes
 *  what" list. Most-overdue first. RLS-scoped. */
export async function ownerOutstanding(ownerId: string): Promise<OutstandingInvoice[]> {
  return withUser(ownerId, async (tx) => {
    const rows = await tx
      .select({
        id: invoices.id,
        type: invoices.type,
        amountCents: invoices.amountCents,
        dueDate: invoices.dueDate,
        status: invoices.status,
        unitNumber: units.unitNumber,
        propertyName: properties.name,
        tenantName: users.fullName,
        tenantEmail: users.email,
      })
      .from(invoices)
      .innerJoin(units, eq(units.id, invoices.unitId))
      .innerJoin(properties, eq(properties.id, units.propertyId))
      .leftJoin(users, eq(users.id, units.tenantId))
      .where(inArray(invoices.status, ["unpaid", "late"]))
      .orderBy(invoices.dueDate);
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amountCents: r.amountCents,
      dueDate: r.dueDate,
      status: r.status,
      unitNumber: r.unitNumber,
      propertyName: r.propertyName,
      tenantName: r.tenantName ?? r.tenantEmail ?? null,
    }));
  });
}

/** Open maintenance requests + all tasks, for the fix-it dashboard. */
export async function listOpenWork(ownerId: string) {
  return withUser(ownerId, async (tx) => {
    const requests = await tx
      .select()
      .from(maintenanceRequests)
      .where(ne(maintenanceRequests.status, "done"))
      .orderBy(desc(maintenanceRequests.createdAt));
    const allTasks = await tx.select().from(tasks).orderBy(desc(tasks.createdAt));
    return { requests, tasks: allTasks };
  });
}

/** Handymen assigned to a property, most-used first (job_count desc). */
export async function rankedHandymen(ownerId: string, propertyId: string) {
  return withUser(ownerId, (tx) =>
    tx
      .select({
        id: users.id,
        name: users.fullName,
        email: users.email,
        jobCount: propertyEmployees.jobCount,
      })
      .from(propertyEmployees)
      .innerJoin(users, eq(users.id, propertyEmployees.employeeId))
      .where(eq(propertyEmployees.propertyId, propertyId))
      .orderBy(desc(propertyEmployees.jobCount)),
  );
}

/** "Give Task": create+assign a task, bump the handyman's job_count, open a chat, notify. */
export async function assignTask(
  ownerId: string,
  opts: { requestId?: string; propertyId: string; assignedTo: string; title: string; deadline?: string | null },
) {
  return asAdmin(async (tx) => {
    const [prop] = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.id, opts.propertyId), eq(properties.ownerId, ownerId)))
      .limit(1);
    if (!prop) throw new Error("Property not found");

    const [task] = await tx
      .insert(tasks)
      .values({
        requestId: opts.requestId ?? null,
        propertyId: opts.propertyId,
        assignedTo: opts.assignedTo,
        title: opts.title,
        deadline: opts.deadline ?? null,
        status: "open",
      })
      .returning();

    if (opts.requestId) {
      const [req] = await tx
        .update(maintenanceRequests)
        .set({ status: "working" })
        .where(eq(maintenanceRequests.id, opts.requestId))
        .returning({ submittedBy: maintenanceRequests.submittedBy });
      // Close the loop back to the tenant who filed the request.
      if (req) {
        await tx.insert(notifications).values({
          recipientId: req.submittedBy,
          type: "info",
          title: "Maintenance underway",
          body: opts.title,
          entityType: "request",
          entityId: opts.requestId,
        });
        await emitEvent(tx, {
          topic: "notification",
          recipients: [req.submittedBy],
          entityType: "request",
          entityId: opts.requestId,
        });
      }
    }
    await tx
      .update(propertyEmployees)
      .set({ jobCount: sql`${propertyEmployees.jobCount} + 1` })
      .where(and(eq(propertyEmployees.propertyId, opts.propertyId), eq(propertyEmployees.employeeId, opts.assignedTo)));

    // One owner↔handyman thread per pair — reuse it across tasks so the
    // messages inbox doesn't show the same handyman once per assigned job.
    const [existingConvo] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.type, "owner_handyman"),
          or(
            and(eq(conversations.participantA, ownerId), eq(conversations.participantB, opts.assignedTo)),
            and(eq(conversations.participantA, opts.assignedTo), eq(conversations.participantB, ownerId)),
          ),
        ),
      )
      .limit(1);
    if (!existingConvo) {
      await tx
        .insert(conversations)
        .values({ participantA: ownerId, participantB: opts.assignedTo, type: "owner_handyman", taskId: task.id });
    } else {
      // Reuse the one manager↔handyman thread, but point it at the job just
      // assigned so the in-chat workflow widget tracks the current job.
      await tx.update(conversations).set({ taskId: task.id }).where(eq(conversations.id, existingConvo.id));
    }

    await tx.insert(notifications).values({
      recipientId: opts.assignedTo,
      type: "info",
      title: "New job assigned",
      body: opts.title,
      entityType: "task",
      entityId: task.id,
    });
    await emitEvent(tx, { topic: "notification", recipients: [opts.assignedTo], entityType: "task", entityId: task.id });
    await emitEvent(tx, { topic: "job", recipients: [opts.assignedTo], taskId: task.id });
    return task;
  });
}

/** Everything the fix-it board needs: open requests (with their property's ranked
 *  handymen for the Give-Task form) and all tasks. RLS-scoped to the owner. */
export async function fixItBoard(ownerId: string) {
  return withUser(ownerId, async (tx) => {
    const reqs = await tx
      .select({
        req: maintenanceRequests,
        unitNumber: units.unitNumber,
        propertyId: properties.id,
        propertyName: properties.name,
      })
      .from(maintenanceRequests)
      .innerJoin(units, eq(units.id, maintenanceRequests.unitId))
      .innerJoin(properties, eq(properties.id, units.propertyId))
      .where(eq(maintenanceRequests.status, "received"))
      .orderBy(desc(maintenanceRequests.createdAt));

    const hands = await tx
      .select({
        propertyId: propertyEmployees.propertyId,
        id: users.id,
        name: users.fullName,
        email: users.email,
        jobCount: propertyEmployees.jobCount,
      })
      .from(propertyEmployees)
      .innerJoin(users, eq(users.id, propertyEmployees.employeeId))
      .orderBy(desc(propertyEmployees.jobCount));

    const allTasks = await tx
      .select({ task: tasks, propertyName: properties.name, assigneeName: users.fullName })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .leftJoin(users, eq(users.id, tasks.assignedTo))
      .orderBy(desc(tasks.createdAt));

    const byProp = new Map<string, { id: string; name: string | null; email: string; jobCount: number }[]>();
    for (const h of hands) {
      const list = byProp.get(h.propertyId) ?? [];
      list.push({ id: h.id, name: h.name, email: h.email, jobCount: h.jobCount });
      byProp.set(h.propertyId, list);
    }

    return {
      requests: reqs.map((r) => ({ ...r, handymen: byProp.get(r.propertyId) ?? [] })),
      tasks: allTasks,
    };
  });
}

/** Owner approves a handyman's estimate → unblocks the work. */
export function approveEstimate(ownerId: string, taskId: string) {
  return asAdmin(async (tx) => {
    const [row] = await tx
      .select({ task: tasks, ownerId: properties.ownerId })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!row || row.ownerId !== ownerId) throw new Error("Task not found");
    await tx.update(tasks).set({ estimateApprovedAt: new Date() }).where(eq(tasks.id, taskId));
    if (row.task.assignedTo) {
      await tx.insert(notifications).values({
        recipientId: row.task.assignedTo,
        type: "success",
        title: "Estimate approved",
        body: row.task.title ?? "",
        entityType: "task",
        entityId: taskId,
      });
      await emitEvent(tx, { topic: "notification", recipients: [row.task.assignedTo], entityType: "task", entityId: taskId });
      await emitEvent(tx, { topic: "job", recipients: [row.task.assignedTo], taskId });
    }
  });
}

/** Owner accepts completion → task done (+ originating request done) → payout notice. */
export function acceptCompletion(ownerId: string, taskId: string) {
  return asAdmin(async (tx) => {
    const [row] = await tx
      .select({ task: tasks, ownerId: properties.ownerId })
      .from(tasks)
      .innerJoin(properties, eq(properties.id, tasks.propertyId))
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!row || row.ownerId !== ownerId) throw new Error("Task not found");
    await tx.update(tasks).set({ status: "done", completedAt: new Date() }).where(eq(tasks.id, taskId));
    if (row.task.requestId) {
      const [req] = await tx
        .update(maintenanceRequests)
        .set({ status: "done" })
        .where(eq(maintenanceRequests.id, row.task.requestId))
        .returning({ submittedBy: maintenanceRequests.submittedBy });
      // Tell the tenant their request is resolved.
      if (req) {
        await tx.insert(notifications).values({
          recipientId: req.submittedBy,
          type: "success",
          title: "Request resolved",
          body: row.task.title ?? "",
          entityType: "request",
          entityId: row.task.requestId,
        });
        await emitEvent(tx, {
          topic: "notification",
          recipients: [req.submittedBy],
          entityType: "request",
          entityId: row.task.requestId,
        });
      }
    }
    if (row.task.assignedTo) {
      await tx.insert(notifications).values({
        recipientId: row.task.assignedTo,
        type: "success",
        title: "Job approved & paid",
        body: row.task.title ?? "",
        entityType: "task",
        entityId: taskId,
      });
      await emitEvent(tx, { topic: "notification", recipients: [row.task.assignedTo], entityType: "task", entityId: taskId });
      await emitEvent(tx, { topic: "job", recipients: [row.task.assignedTo], taskId });
    }
  });
}
