"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronDown, ChevronRight, MapPin, MessageSquare, Navigation } from "lucide-react";
import type { Urgency } from "@/server/services/handyman";
import { acceptJobAction, declineJobAction, openJobChatAction } from "@/actions/handyman";
import { formatCents } from "@/lib/utils";
import { urgencyOf, milesBetween, formatMiles } from "./urgency";

export interface JobCard {
  id: string;
  title: string | null;
  propertyName: string;
  propertyAddress: string | null;
  lat: number | null;
  lng: number | null;
  urgency: Urgency | null;
  status: "open" | "accepted" | "done";
  deadline: string | null;
  estimateCents: number | null;
  finalCostCents: number | null;
}

const STATUS: Record<JobCard["status"], { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
  accepted: { label: "In progress", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  done: { label: "Done", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
};

const SORTS = [
  { key: "status", label: "Default" },
  { key: "distance", label: "Distance" },
  { key: "urgency", label: "Urgency" },
  { key: "due", label: "Due date" },
  // "Done" is a view, not a sort: it's the only option that shows completed jobs.
  { key: "done", label: "Done" },
] as const;

/** Stylized dropdown (replaces the native <select>): button + popup menu, click-outside to close. */
function SortDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const current = SORTS.find((s) => s.key === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface py-1.5 pl-3 pr-2 text-xs font-medium transition hover:bg-surface-2"
      >
        {current?.label}
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-40 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg shadow-black/10">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                onChange(s.key);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                value === s.key ? "bg-brand/10 font-semibold text-brand" : "hover:bg-surface-2"
              }`}
            >
              {s.label}
              {value === s.key && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const URG_RANK: Record<string, number> = { urgent: 4, high: 3, med: 2, low: 1 };
const STATUS_RANK: Record<JobCard["status"], number> = { accepted: 0, open: 1, done: 2 };

/** Lower number = "least" (sorts first when ascending). */
function sortValue(j: JobCard, field: string, me: { lat: number; lng: number } | null): number {
  if (field === "distance") {
    return me && j.lat != null && j.lng != null ? milesBetween(me, { lat: j.lat, lng: j.lng }) : Infinity;
  }
  if (field === "urgency") return j.urgency ? URG_RANK[j.urgency] : 0;
  if (field === "due") return j.deadline ? new Date(j.deadline).getTime() : Infinity;
  return STATUS_RANK[j.status];
}

function sortJobs(
  jobs: JobCard[],
  field: string,
  dir: "asc" | "desc",
  me: { lat: number; lng: number } | null,
): JobCard[] {
  const mult = dir === "desc" ? -1 : 1;
  return [...jobs].sort((a, b) => (sortValue(a, field, me) - sortValue(b, field, me)) * mult);
}

export function JobsList({ jobs }: { jobs: JobCard[] }) {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [sortField, setSortField] = useState<string>("status");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMe(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // "Done" view shows only completed jobs; every other option hides them.
  const showDone = sortField === "done";
  const shown = sortJobs(
    jobs.filter((j) => (showDone ? j.status === "done" : j.status !== "done")),
    sortField,
    dir,
    me,
  );

  return (
    <div className="space-y-3">
      {!me && (
        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          <Navigation className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Enable location to show how far each job is</span>
          <button
            type="button"
            onClick={requestLocation}
            className="shrink-0 rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background transition hover:opacity-90"
          >
            Enable
          </button>
        </div>
      )}

      {/* sort + view controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted">Sort by</span>
        <SortDropdown value={sortField} onChange={setSortField} />
        {!showDone && (
          <button
            type="button"
            onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={dir === "asc" ? "Ascending — least first" : "Descending — most first"}
            title={dir === "asc" ? "Least first" : "Most first"}
            className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-line bg-surface text-muted transition hover:text-foreground"
          >
            {dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {shown.length === 0 && (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No {showDone ? "completed" : "active"} jobs right now.
        </p>
      )}

      {shown.map((job) => {
        const u = urgencyOf(job.urgency);
        const s = STATUS[job.status];
        const distance =
          me && job.lat != null && job.lng != null
            ? formatMiles(milesBetween(me, { lat: job.lat, lng: job.lng }))
            : null;

        return (
          <div
            key={job.id}
            className="rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-foreground/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/jobs/${job.id}`} className="text-[15px] font-semibold tracking-tight hover:underline">
                  {job.title ?? "Maintenance task"}
                </Link>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {job.propertyName}
                    {job.propertyAddress ? ` · ${job.propertyAddress}` : ""}
                  </span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
                {s.label}
              </span>
            </div>

            {/* meta chips + actions on one compact row */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide"
                style={{ background: u.bg, color: u.text }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: u.pin }} />
                {u.label}
              </span>
              {distance && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
                  <Navigation className="h-3 w-3" />
                  {distance} away
                </span>
              )}
              {job.deadline && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                  <CalendarDays className="h-3 w-3" />
                  Due {job.deadline}
                </span>
              )}
              {job.finalCostCents != null && (
                <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                  Final {formatCents(job.finalCostCents)}
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                {job.status === "open" && (
                  <>
                    <form action={acceptJobAction}>
                      <input type="hidden" name="taskId" value={job.id} />
                      <button className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:opacity-90">
                        Accept
                      </button>
                    </form>
                    <form action={declineJobAction}>
                      <input type="hidden" name="taskId" value={job.id} />
                      <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-surface-2">
                        Decline
                      </button>
                    </form>
                  </>
                )}
                <form action={openJobChatAction}>
                  <input type="hidden" name="taskId" value={job.id} />
                  <button className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium transition hover:bg-surface-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chat
                  </button>
                </form>
                <Link
                  href={`/jobs/${job.id}`}
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-muted transition hover:text-foreground"
                >
                  Details
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
