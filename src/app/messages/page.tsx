import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireUser } from "@/server/auth/guard";
import { getOrCreateOwnerConversation, listConversations } from "@/server/services/messaging";
import { NotConnected } from "@/components/not-connected";
import { Badge, Card, EmptyState } from "@/components/ui";

const ROLE_TAG: Record<string, string> = { owner: "manager", employee: "handyman", tenant: "tenant" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name[0]?.toUpperCase() || "?";
}

export default async function MessagesPage() {
  const user = await requireUser();
  let convos: Awaited<ReturnType<typeof listConversations>> = [];
  let dbReady = true;
  try {
    if (user.role === "tenant") await getOrCreateOwnerConversation(user.id).catch(() => {});
    convos = await listConversations(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted">Your conversations.</p>
      </div>
      {!dbReady ? (
        <NotConnected />
      ) : convos.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No conversations yet" hint="Messages with your manager will appear here." />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {convos.map(({ conversation, other, last }) => {
            const name = other?.fullName ?? other?.email ?? "Conversation";
            return (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-3 p-4 transition hover:bg-surface-2"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{name}</div>
                  <div className="truncate text-sm text-muted">{last?.body ?? "No messages yet"}</div>
                </div>
                {other && <Badge tone="neutral">{ROLE_TAG[other.role] ?? other.role}</Badge>}
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
