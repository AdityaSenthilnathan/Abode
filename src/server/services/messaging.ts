import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import { emitEvent } from "@/server/realtime/emit";
import { conversations, maintenanceRequests, messages, properties, propertyEmployees, taskReceipts, tasks, units, users } from "@db/schema";
import type { Task } from "@db/schema";

/**
 * Per-conversation "waiting on" status, from the handyman's perspective.
 *  - tone "orange" → the other person is waiting on YOU (action needed)
 *  - tone "green"  → YOU are waiting on them
 */
export interface WaitStatus {
  tone: "orange" | "green";
  label: string;
}

function handymanWait(task: Task, otherIsTenant: boolean): WaitStatus | null {
  if (task.status === "done") return null;
  if (otherIsTenant) return { tone: "orange", label: "Tenant is waiting on the repair" };
  // owner / manager — follow the job workflow
  if (task.status === "open") return { tone: "orange", label: "Waiting for you to accept the job" };
  if (task.estimateCents == null) return { tone: "orange", label: "Waiting for you to send an estimate" };
  if (task.estimateApprovedAt == null) return { tone: "green", label: "Waiting for them to approve your estimate" };
  if (task.finalCostCents == null) return { tone: "orange", label: "Waiting for you to complete the job" };
  return { tone: "green", label: "Waiting for them to sign off" };
}

export interface ConversationListItem {
  id: string;
  otherName: string;
  otherRole: string | null;
  /** For a tenant participant: "Maple Court · Unit 101" (their home). Null otherwise. */
  otherLocation: string | null;
  lastBody: string | null;
  taskId: string | null;
  taskTitle: string | null;
  wait: WaitStatus | null;
}

/** Conversation list enriched with the other party, last message, and (handyman) waiting status. */
export async function listConversationsForUser(userId: string, role: string): Promise<ConversationListItem[]> {
  // Seeing the inbox = the messages reached you → mark them delivered.
  await markDelivered(userId);
  return withUser(userId, async (tx) => {
    const convos = await tx.select().from(conversations);
    if (convos.length === 0) return [];

    // Load linked tasks once (only the handyman view derives a workflow status).
    const taskMap = new Map<string, Task>();
    const taskIds = convos.map((c) => c.taskId).filter((id): id is string => !!id);
    if (role === "employee" && taskIds.length) {
      const ts = await tx.select().from(tasks).where(inArray(tasks.id, taskIds));
      for (const t of ts) taskMap.set(t.id, t);
    }

    // Batch the former per-conversation lookups: all "other" participants in one
    // query, and the latest message per conversation via DISTINCT ON — instead
    // of 2 queries for every conversation in the list.
    const otherIds = [...new Set(convos.map((c) => (c.participantA === userId ? c.participantB : c.participantA)))];
    const convoIds = convos.map((c) => c.id);
    const userRows = await tx
      .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role })
      .from(users)
      .where(inArray(users.id, otherIds));
    const lastRows = await tx
      .selectDistinctOn([messages.conversationId])
      .from(messages)
      .where(inArray(messages.conversationId, convoIds))
      .orderBy(messages.conversationId, desc(messages.sentAt));
    const userById = new Map(userRows.map((u) => [u.id, u] as const));
    const lastByConvo = new Map(lastRows.map((m) => [m.conversationId, m] as const));

    // Where each tenant participant lives, so the list can show "Maple Court ·
    // Unit 101" next to the name (mainly for the owner triaging conversations).
    const tenantIds = userRows.filter((u) => u.role === "tenant").map((u) => u.id);
    const locByTenant = new Map<string, string>();
    if (tenantIds.length) {
      const unitRows = await tx
        .select({ tenantId: units.tenantId, unitNumber: units.unitNumber, propertyName: properties.name })
        .from(units)
        .innerJoin(properties, eq(properties.id, units.propertyId))
        .where(inArray(units.tenantId, tenantIds));
      for (const r of unitRows) {
        if (r.tenantId) locByTenant.set(r.tenantId, `${r.propertyName} · Unit ${r.unitNumber}`);
      }
    }

    const out = convos.map((c) => {
      const otherId = c.participantA === userId ? c.participantB : c.participantA;
      const other = userById.get(otherId);
      const last = lastByConvo.get(c.id);
      const task = c.taskId ? taskMap.get(c.taskId) : undefined;
      const wait = role === "employee" && task ? handymanWait(task, other?.role === "tenant") : null;
      return {
        id: c.id,
        otherName: other?.fullName ?? other?.email ?? "Conversation",
        otherRole: other?.role ?? null,
        otherLocation: other?.role === "tenant" ? locByTenant.get(otherId) ?? null : null,
        lastBody: last?.body ?? null,
        taskId: c.taskId,
        taskTitle: task?.title ?? null,
        wait,
        lastAt: last?.sentAt ? new Date(last.sentAt).getTime() : 0,
      };
    });
    out.sort((a, b) => b.lastAt - a.lastAt);
    return out.map(({ lastAt: _lastAt, ...rest }) => rest);
  });
}

/** Conversations the user is in, with the other participant + last message. */
export async function listConversations(userId: string) {
  return withUser(userId, async (tx) => {
    const convos = await tx.select().from(conversations);
    if (convos.length === 0) return [];

    // Same batching as listConversationsForUser: one query for participants, one
    // DISTINCT ON for the latest message per conversation (was 2 per row).
    const otherIds = [...new Set(convos.map((c) => (c.participantA === userId ? c.participantB : c.participantA)))];
    const convoIds = convos.map((c) => c.id);
    const userRows = await tx
      .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role })
      .from(users)
      .where(inArray(users.id, otherIds));
    const lastRows = await tx
      .selectDistinctOn([messages.conversationId])
      .from(messages)
      .where(inArray(messages.conversationId, convoIds))
      .orderBy(messages.conversationId, desc(messages.sentAt));
    const userById = new Map(userRows.map((u) => [u.id, u] as const));
    const lastByConvo = new Map(lastRows.map((m) => [m.conversationId, m] as const));

    return convos
      .map((c) => {
        const otherId = c.participantA === userId ? c.participantB : c.participantA;
        return { conversation: c, other: userById.get(otherId), last: lastByConvo.get(c.id) ?? undefined };
      })
      .sort((a, b) => {
        const ta = a.last?.sentAt ? new Date(a.last.sentAt).getTime() : 0;
        const tb = b.last?.sentAt ? new Date(b.last.sentAt).getTime() : 0;
        return tb - ta;
      });
  });
}

/**
 * Mark the other participant's messages in a conversation as read by `userId`
 * (and delivered if not already). Uses asAdmin: RLS only lets a user write rows
 * they sent, but read receipts flip the recipient's columns on the sender's rows.
 */
export async function markRead(userId: string, conversationId: string) {
  return asAdmin((tx) =>
    tx
      .update(messages)
      .set({ readAt: new Date(), deliveredAt: sql`coalesce(${messages.deliveredAt}, now())` })
      .where(
        and(eq(messages.conversationId, conversationId), ne(messages.senderId, userId), isNull(messages.readAt)),
      ),
  );
}

/** Mark every incoming, not-yet-delivered message across the user's conversations as delivered. */
export async function markDelivered(userId: string) {
  return asAdmin((tx) =>
    tx
      .update(messages)
      .set({ deliveredAt: new Date() })
      .where(
        and(
          ne(messages.senderId, userId),
          isNull(messages.deliveredAt),
          inArray(
            messages.conversationId,
            tx
              .select({ id: conversations.id })
              .from(conversations)
              .where(or(eq(conversations.participantA, userId), eq(conversations.participantB, userId))),
          ),
        ),
      ),
  );
}

/** A full thread (messages + the other party's name). Null if not a participant (RLS). */
export async function getThread(userId: string, conversationId: string) {
  return withUser(userId, async (tx) => {
    const [c] = await tx.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!c) return null;
    const otherId = c.participantA === userId ? c.participantB : c.participantA;
    const [other] = await tx
      .select({ fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, otherId))
      .limit(1);
    // Viewing the thread = reading the other party's messages.
    await markRead(userId, conversationId);
    const msgs = await tx
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.sentAt));
    return { conversation: c, otherName: other?.fullName ?? other?.email ?? "Conversation", messages: msgs };
  });
}

export interface ConversationJob {
  taskId: string;
  title: string | null;
  status: "open" | "accepted" | "done";
  estimateCents: number | null;
  estimateApproved: boolean;
  finalCostCents: number | null;
  receiptCount: number;
}

/** The job (task) a conversation is about, with enough state to drive the in-chat workflow. Null if the chat isn't task-linked. */
export async function getConversationJob(userId: string, conversationId: string): Promise<ConversationJob | null> {
  return withUser(userId, async (tx) => {
    const [c] = await tx.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!c?.taskId) return null;
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, c.taskId)).limit(1);
    if (!task) return null;
    const receipts = await tx.select({ id: taskReceipts.id }).from(taskReceipts).where(eq(taskReceipts.taskId, c.taskId));
    return {
      taskId: task.id,
      title: task.title,
      status: task.status,
      estimateCents: task.estimateCents,
      estimateApproved: task.estimateApprovedAt != null,
      finalCostCents: task.finalCostCents,
      receiptCount: receipts.length,
    };
  });
}

export async function sendMessage(userId: string, conversationId: string, body: string) {
  return withUser(userId, async (tx) => {
    // RLS lets a participant read their own conversation row, so we can resolve
    // the other party for a realtime "message" signal without asAdmin.
    const [c] = await tx
      .select({ a: conversations.participantA, b: conversations.participantB, taskId: conversations.taskId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    const rows = await tx.insert(messages).values({ conversationId, senderId: userId, body }).returning();
    if (c) {
      const recipient = c.a === userId ? c.b : c.a;
      await emitEvent(tx, { topic: "message", recipients: [recipient], conversationId, taskId: c.taskId ?? null });
    }
    return rows;
  });
}

/**
 * Resolve—or create—the direct 1:1 conversation between the current user and a
 * person reachable from their account page: a tenant's manager or maintenance
 * staff, a manager's handymen, a handyman's managers. The pairing is validated
 * against the property graph so a user can't open a thread with an arbitrary
 * account; returns null when no such relationship exists. asAdmin because we may
 * create a row whose other participant the caller can't yet see under RLS — the
 * same trust model the other getOrCreate* helpers use.
 */
export async function getOrCreateDirectConversation(
  currentUserId: string,
  targetUserId: string,
): Promise<string | null> {
  if (currentUserId === targetUserId) return null;
  return asAdmin(async (tx) => {
    const people = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(inArray(users.id, [currentUserId, targetUserId]));
    const me = people.find((p) => p.id === currentUserId);
    const them = people.find((p) => p.id === targetUserId);
    if (!me || !them) return null;

    const owner = me.role === "owner" ? me.id : them.role === "owner" ? them.id : null;
    const tenant = me.role === "tenant" ? me.id : them.role === "tenant" ? them.id : null;
    const handyman = me.role === "employee" ? me.id : them.role === "employee" ? them.id : null;

    let type: "owner_tenant" | "owner_handyman" | "handyman_tenant";
    let a: string;
    let b: string;
    let related = false;

    if (owner && tenant) {
      type = "owner_tenant";
      [a, b] = [owner, tenant];
      const [r] = await tx
        .select({ id: units.id })
        .from(units)
        .innerJoin(properties, eq(properties.id, units.propertyId))
        .where(and(eq(properties.ownerId, owner), eq(units.tenantId, tenant)))
        .limit(1);
      related = !!r;
    } else if (owner && handyman) {
      type = "owner_handyman";
      [a, b] = [owner, handyman];
      const [r] = await tx
        .select({ id: propertyEmployees.propertyId })
        .from(propertyEmployees)
        .innerJoin(properties, eq(properties.id, propertyEmployees.propertyId))
        .where(and(eq(properties.ownerId, owner), eq(propertyEmployees.employeeId, handyman)))
        .limit(1);
      related = !!r;
    } else if (handyman && tenant) {
      type = "handyman_tenant";
      [a, b] = [handyman, tenant];
      const [r] = await tx
        .select({ id: units.id })
        .from(units)
        .innerJoin(propertyEmployees, eq(propertyEmployees.propertyId, units.propertyId))
        .where(and(eq(propertyEmployees.employeeId, handyman), eq(units.tenantId, tenant)))
        .limit(1);
      related = !!r;
    } else {
      return null;
    }
    if (!related) return null;

    const [existing] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.type, type),
          or(
            and(eq(conversations.participantA, a), eq(conversations.participantB, b)),
            and(eq(conversations.participantA, b), eq(conversations.participantB, a)),
          ),
        ),
      )
      .limit(1);
    if (existing) return existing.id;
    const [c] = await tx
      .insert(conversations)
      .values({ participantA: a, participantB: b, type })
      .returning();
    return c.id;
  });
}

/** Find or create the owner↔tenant conversation for a tenant. */
export async function getOrCreateOwnerConversation(tenantId: string): Promise<string> {
  return asAdmin(async (tx) => {
    const [row] = await tx
      .select({ ownerId: properties.ownerId })
      .from(units)
      .innerJoin(properties, eq(properties.id, units.propertyId))
      .where(eq(units.tenantId, tenantId))
      .limit(1);
    if (!row) throw new Error("No manager found for your unit");
    const ownerId = row.ownerId;
    const [existing] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.type, "owner_tenant"),
          or(
            and(eq(conversations.participantA, ownerId), eq(conversations.participantB, tenantId)),
            and(eq(conversations.participantA, tenantId), eq(conversations.participantB, ownerId)),
          ),
        ),
      )
      .limit(1);
    if (existing) return existing.id;
    const [c] = await tx
      .insert(conversations)
      .values({ participantA: ownerId, participantB: tenantId, type: "owner_tenant" })
      .returning();
    return c.id;
  });
}

/** Handyman↔tenant conversation (one per pair), linked to the job that prompted it. */
export async function getOrCreateHandymanTenantConversation(
  handymanId: string,
  tenantId: string,
  taskId: string,
): Promise<string> {
  return asAdmin(async (tx) => {
    const [existing] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.type, "handyman_tenant"),
          or(
            and(eq(conversations.participantA, handymanId), eq(conversations.participantB, tenantId)),
            and(eq(conversations.participantA, tenantId), eq(conversations.participantB, handymanId)),
          ),
        ),
      )
      .limit(1);
    if (existing) {
      if (!existing.taskId && taskId) {
        await tx.update(conversations).set({ taskId }).where(eq(conversations.id, existing.id));
      }
      return existing.id;
    }
    const [c] = await tx
      .insert(conversations)
      .values({ participantA: handymanId, participantB: tenantId, type: "handyman_tenant", taskId })
      .returning();
    return c.id;
  });
}

/** Ensure the handyman has both the manager and tenant conversations for a job. Returns the manager chat id. */
export async function ensureJobConversations(
  handymanId: string,
  taskId: string,
): Promise<{ ownerConversationId: string | null }> {
  const info = await asAdmin(async (tx) => {
    const [t] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.assignedTo, handymanId)))
      .limit(1);
    if (!t) return null;
    const [prop] = await tx
      .select({ ownerId: properties.ownerId })
      .from(properties)
      .where(eq(properties.id, t.propertyId))
      .limit(1);
    let tenantId: string | null = null;
    if (t.requestId) {
      const [r] = await tx
        .select({ tenantId: units.tenantId })
        .from(maintenanceRequests)
        .innerJoin(units, eq(units.id, maintenanceRequests.unitId))
        .where(eq(maintenanceRequests.id, t.requestId))
        .limit(1);
      tenantId = r?.tenantId ?? null;
    }
    return { ownerId: prop?.ownerId ?? null, tenantId };
  });
  if (!info) throw new Error("Job not found");
  let ownerConversationId: string | null = null;
  if (info.ownerId) ownerConversationId = await getOrCreateOwnerHandymanConversation(info.ownerId, handymanId, taskId);
  if (info.tenantId) await getOrCreateHandymanTenantConversation(handymanId, info.tenantId, taskId);
  return { ownerConversationId };
}

/** Post a message from the handyman into the one manager (owner↔handyman) chat, scoped to this job. */
export async function messageManagerForTask(handymanId: string, taskId: string, body: string): Promise<void> {
  const { ownerConversationId } = await ensureJobConversations(handymanId, taskId);
  if (!ownerConversationId) return;
  await withUser(handymanId, async (tx) => {
    const [c] = await tx
      .select({ a: conversations.participantA, b: conversations.participantB, taskId: conversations.taskId })
      .from(conversations)
      .where(eq(conversations.id, ownerConversationId))
      .limit(1);
    await tx.insert(messages).values({ conversationId: ownerConversationId, senderId: handymanId, body });
    if (c) {
      const recipient = c.a === handymanId ? c.b : c.a;
      await emitEvent(tx, {
        topic: "message",
        recipients: [recipient],
        conversationId: ownerConversationId,
        taskId: c.taskId ?? null,
      });
    }
  });
}

/**
 * The single owner↔handyman conversation for this pair — one chat per manager,
 * reused across every job they assign (and across all the properties that
 * manager owns). Keyed by the participant pair, NOT by task, so a worker with
 * several jobs from the same manager never ends up with duplicate threads.
 * `taskId` is repointed at the given task so the in-chat job widget tracks the
 * job the worker is currently acting on.
 */
export async function getOrCreateOwnerHandymanConversation(
  ownerId: string,
  handymanId: string,
  taskId: string,
): Promise<string> {
  return asAdmin(async (tx) => {
    const [existing] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.type, "owner_handyman"),
          or(
            and(eq(conversations.participantA, ownerId), eq(conversations.participantB, handymanId)),
            and(eq(conversations.participantA, handymanId), eq(conversations.participantB, ownerId)),
          ),
        ),
      )
      .limit(1);
    if (existing) {
      if (taskId && existing.taskId !== taskId) {
        await tx.update(conversations).set({ taskId }).where(eq(conversations.id, existing.id));
      }
      return existing.id;
    }
    const [c] = await tx
      .insert(conversations)
      .values({ participantA: ownerId, participantB: handymanId, type: "owner_handyman", taskId })
      .returning();
    return c.id;
  });
}

/**
 * Count of incoming, not-yet-read messages across all of the user's
 * conversations — drives the global Messages-tab badge so new messages surface
 * on any screen, not just inside an open thread. RLS scopes `messages` to the
 * user's own conversations (same visibility as getThread), so counting rows the
 * user didn't send and hasn't read yields their unread total.
 */
export async function unreadMessageCount(userId: string): Promise<number> {
  return withUser(userId, async (tx) => {
    const [row] = await tx
      .select({ n: count() })
      .from(messages)
      .where(and(ne(messages.senderId, userId), isNull(messages.readAt)));
    return Number(row?.n ?? 0);
  });
}
