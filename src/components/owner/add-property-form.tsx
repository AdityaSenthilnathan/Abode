"use client";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import type { CreatePropertyState } from "@/actions/invites";

type Action = (state: CreatePropertyState, formData: FormData) => Promise<CreatePropertyState>;

/** A real, map-verified address Mapbox returned for a typed query. */
interface Suggestion {
  id: string;
  full: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
}

interface MapboxFeature {
  id?: string;
  properties?: {
    mapbox_id?: string;
    full_address?: string;
    place_formatted?: string;
    name?: string;
    coordinates?: { longitude?: number; latitude?: number };
    context?: {
      address?: { name?: string };
      place?: { name?: string };
      region?: { name?: string; region_code?: string };
      postcode?: { name?: string };
    };
  };
  geometry?: { coordinates?: [number, number] };
}

function toSuggestion(f: MapboxFeature, i: number): Suggestion | null {
  const ctx = f.properties?.context;
  const lng = f.properties?.coordinates?.longitude ?? f.geometry?.coordinates?.[0];
  const lat = f.properties?.coordinates?.latitude ?? f.geometry?.coordinates?.[1];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    id: f.properties?.mapbox_id ?? f.id ?? String(i),
    full: f.properties?.full_address ?? f.properties?.place_formatted ?? f.properties?.name ?? "",
    street: ctx?.address?.name ?? f.properties?.name ?? "",
    city: ctx?.place?.name ?? "",
    state: ctx?.region?.region_code ?? ctx?.region?.name ?? "",
    zip: ctx?.postcode?.name ?? "",
    lat,
    lng,
  };
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={disabled || pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Add property
    </button>
  );
}

const inputCls =
  "rounded-md border border-black/15 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function AddPropertyForm({ action, token }: { action: Action; token?: string }) {
  const [state, formAction] = useActionState<CreatePropertyState, FormData>(action, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [zip, setZip] = useState("");

  // The currently locked-in, map-verified location. Null until the user picks a
  // suggestion (or "Verify" snaps to one). Any manual edit clears it, forcing a
  // re-verify — you can never submit an address that wasn't confirmed real.
  const [verified, setVerified] = useState<Suggestion | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Without a token we can't geocode; fall back to plain free-text entry (legacy
  // behaviour) and let the server store it without coordinates.
  const requireVerify = Boolean(token);

  // Reset the form once the server confirms the property was created.
  useEffect(() => {
    if (state.ok) {
      setName("");
      setStreet("");
      setCity("");
      setRegion("");
      setZip("");
      setVerified(null);
      setSuggestions([]);
      formRef.current?.reset();
    }
  }, [state.ok]);

  // Combine the structured fields into a single biased query so the autocomplete
  // "corrects" a roughly-typed street using the city/state/zip already entered.
  function buildQuery(overrideStreet?: string) {
    return [overrideStreet ?? street, city, region, zip]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }

  async function fetchSuggestions(query: string): Promise<Suggestion[]> {
    if (!token || query.trim().length < 3) return [];
    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", query);
    url.searchParams.set("access_token", token);
    url.searchParams.set("country", "us");
    url.searchParams.set("autocomplete", "true");
    url.searchParams.set("types", "address");
    url.searchParams.set("limit", "6");
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: MapboxFeature[] };
    return (data.features ?? []).map(toSuggestion).filter((s): s is Suggestion => s != null);
  }

  // Debounced autocomplete as the user types the street line.
  useEffect(() => {
    if (!requireVerify || verified) return;
    const q = buildQuery();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setSuggestions(await fetchSuggestions(q));
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // Re-run when any address part changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, city, region, zip, verified, requireVerify]);

  function applySuggestion(s: Suggestion) {
    setStreet(s.street || s.full);
    setCity(s.city);
    setRegion(s.state);
    setZip(s.zip);
    setVerified(s);
    setVerifyError(null);
    setOpen(false);
    setSuggestions([]);
  }

  // Any manual edit invalidates a prior verification.
  function edited(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      if (verified) setVerified(null);
      setVerifyError(null);
    };
  }

  // "Verify" / autocorrect: snap the typed fields to the single best real match.
  async function verifyNow() {
    if (!token) return;
    setLoading(true);
    setVerifyError(null);
    try {
      const [best] = await fetchSuggestions(buildQuery());
      if (best) applySuggestion(best);
      else setVerifyError("No matching address found. Check the street, city, and state.");
    } finally {
      setLoading(false);
    }
  }

  const addressForSubmit = verified?.full || buildQuery();
  const canSubmit = name.trim().length > 0 && (requireVerify ? Boolean(verified) : street.trim().length > 0);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/15"
    >
      {/* Server passes the verified address + coordinates through these. */}
      <input type="hidden" name="address" value={addressForSubmit} />
      <input type="hidden" name="lat" value={verified?.lat ?? ""} />
      <input type="hidden" name="lng" value={verified?.lng ?? ""} />

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="opacity-60">Property name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Maple Court"
            className={inputCls}
          />
        </label>

        <label className="relative flex flex-1 flex-col gap-1 text-xs">
          <span className="opacity-60">Street address</span>
          <div className="relative">
            <input
              value={street}
              onChange={(e) => edited(setStreet)(e.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              required
              autoComplete="off"
              placeholder="123 Main St"
              className={`${inputCls} w-full pr-7`}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-50">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </span>

            {open && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-black/10 bg-background shadow-lg dark:border-white/15">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      // onMouseDown fires before the input's blur, so the pick lands.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(s);
                      }}
                      className="flex w-full items-start gap-2 px-2.5 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50" />
                      <span>{s.full}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="opacity-60">City</span>
          <input
            value={city}
            onChange={(e) => edited(setCity)(e.target.value)}
            placeholder="Springfield"
            className={`${inputCls} w-full`}
          />
        </label>
        <label className="flex w-20 flex-col gap-1 text-xs">
          <span className="opacity-60">State</span>
          <input
            value={region}
            onChange={(e) => edited(setRegion)(e.target.value)}
            placeholder="CA"
            className={`${inputCls} w-full`}
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-xs">
          <span className="opacity-60">ZIP</span>
          <input
            value={zip}
            onChange={(e) => edited(setZip)(e.target.value)}
            placeholder="94016"
            className={`${inputCls} w-full`}
          />
        </label>

        {requireVerify && !verified && (
          <button
            type="button"
            onClick={verifyNow}
            disabled={loading || buildQuery().length < 3}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
          >
            Verify address
          </button>
        )}
        <SubmitButton disabled={!canSubmit} />
      </div>

      {/* Status / errors */}
      {verified ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600">
          <Check className="h-3.5 w-3.5" /> Verified location · {verified.full}
        </p>
      ) : requireVerify ? (
        <p className="text-xs opacity-60">
          Pick a suggestion or hit “Verify address” — only addresses found on the map can be added.
        </p>
      ) : null}
      {verifyError && <p className="text-xs text-red-600">{verifyError}</p>}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
