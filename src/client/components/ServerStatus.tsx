import type { HealthResponse } from "@shared/api.ts";
import { useEffect, useState } from "react";

type Status =
  | { state: "loading" }
  | { state: "online"; health: HealthResponse }
  | { state: "offline" };

/**
 * Small badge showing live connectivity to the DoughFolio backend.
 * Demonstrates the end-to-end wiring: shared types → API route → UI.
 */
export function ServerStatus() {
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/health")
      .then((response) => response.json() as Promise<HealthResponse>)
      .then((health) => {
        if (!cancelled) setStatus({ state: "online", health });
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: "offline" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status.state === "loading") {
    return <Badge dotClass="bg-dough animate-pulse" label="Checking the steamer…" />;
  }
  if (status.state === "offline") {
    return <Badge dotClass="bg-blush-dark" label="Server is offline" />;
  }
  return (
    <Badge dotClass="bg-matcha-dark" label={`Server is steaming — v${status.health.version}`} />
  );
}

function Badge({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-ink-soft shadow-sm">
      <span className={`size-2.5 rounded-full ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}
