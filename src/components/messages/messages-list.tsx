"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { ConversationListItem } from "@/server/services/messaging";
import { Card } from "@/components/ui";

const ROLE_TAG: Record<string, string> = { owner: "manager", employee: "handyman", tenant: "tenant" };

// The two role buckets a viewer can filter by depend on who they talk to.
const FILTER_BUCKETS: Record<string, { label: string; role: string }[]> = {
  employee: [
    { label: "Managers", role: "owner" },
    { label: "Tenants", role: "tenant" },
  ],
  owner: [
    { label: "Handymen", role: "employee" },
    { label: "Tenants", role: "tenant" },
  ],
  tenant: [
    { label: "Owners", role: "owner" },
    { label: "Handymen", role: "employee" },
  ],
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name[0]?.toUpperCase() || "?";
}

export interface SelectedJob {
  taskId: string;
  title: string;
  conversationIds: string[];
}

export function MessagesList({
  items,
  selected,
  role,
}: {
  items: ConversationListItem[];
  selected: SelectedJob | null;
  role: string;
}) {
  const [filter, setFilter] = useState("all");
  const options = [{ label: "All", role: "all" }, ...(FILTER_BUCKETS[role] ?? FILTER_BUCKETS.employee)];

  // Selecting a job (or clearing it with ✕) returns to the All view, as the
  // component persists across soft navigation between /messages and /messages?job=.
  useEffect(() => {
    setFilter("all");
  }, [selected?.taskId]);

  const selectedIds = new Set(selected?.conversationIds ?? []);
  const visible = items.filter((i) => filter === "all" || i.otherRole === filter);
  // Pin the selected job's conversations to the top.
  const sorted = [...visible].sort((a, b) => Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id)));

  return (
    <div className="space-y-4">
      {/* Filter toggle */}
      <div className="inline-flex rounded-xl border border-line bg-surface p-1 text-sm">
        {options.map((o) => (
          <button
            key={o.role}
            type="button"
            onClick={() => setFilter(o.role)}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              filter === o.role ? "bg-brand text-brand-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Selected-job banner */}
      {selected && (
        <div
          className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm"
          title="You have this job selected — click ✕ to return to all messages."
        >
          <span className="flex-1">
            Showing contacts for <span className="font-semibold">{selected.title}</span>
          </span>
          <Link
            href="/messages"
            aria-label="Clear job selection"
            title="Back to all messages"
            className="grid h-6 w-6 place-items-center rounded-full text-brand transition hover:bg-brand/20"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted">No conversations in this view.</p>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {sorted.map((item) => {
            const isSel = selectedIds.has(item.id);
            return (
              <Link
                key={item.id}
                href={`/messages/${item.id}`}
                className={`flex items-center gap-3 p-4 transition hover:bg-surface-2 ${
                  isSel ? "bg-brand/[0.06] ring-1 ring-inset ring-brand/30" : ""
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {initials(item.otherName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.otherName}</span>
                    {item.otherRole && (
                      <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-medium capitalize text-muted">
                        {ROLE_TAG[item.otherRole] ?? item.otherRole}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-muted">{item.lastBody ?? "No messages yet"}</div>
                  {item.wait && (
                    <span
                      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.wait.tone === "green"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          item.wait.tone === "green" ? "bg-emerald-500" : "bg-orange-500"
                        }`}
                      />
                      {item.wait.label}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
