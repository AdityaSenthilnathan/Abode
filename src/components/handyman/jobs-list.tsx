"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin, MessageSquare, Navigation } from "lucide-react";
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

export function JobsList({ jobs }: { jobs: JobCard[] }) {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

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

      {jobs.map((job) => {
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

            {/* meta chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
            </div>

            {/* actions */}
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
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
              <form action={openJobChatAction} className="ml-auto">
                <input type="hidden" name="taskId" value={job.id} />
                <button className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-surface-2">
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
        );
      })}
    </div>
  );
}
