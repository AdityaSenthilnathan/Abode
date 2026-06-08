import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { asAdmin, withUser } from "@/server/db/rls";
import { notifications } from "@db/schema";

export type NotifType = "urgent" | "success" | "info";

/** A user's notifications, newest first (RLS → only their own). */
export function listNotifications(userId: string) {
  return withUser(userId, (tx) => tx.select().from(notifications).orderBy(desc(notifications.createdAt)));
}

export function markNotificationRead(userId: string, id: string) {
  return withUser(userId, (tx) =>
    tx.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id)),
  );
}

export async function unreadCount(userId: string): Promise<number> {
  return withUser(userId, async (tx) => {
    const rows = await tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.recipientId, userId), isNull(notifications.readAt)));
    return rows.length;
  });
}

/** Insert a notification for a recipient (trusted/system path). M5 adds realtime push. */
export async function notify(opts: {
  recipientId: string;
  type: NotifType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}) {
  return asAdmin((tx) =>
    tx.insert(notifications).values({
      recipientId: opts.recipientId,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
    }),
  );
}
