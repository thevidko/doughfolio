import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { useSetupStatus } from "../hooks/useSetupStatus.tsx";
import { apiFetch } from "../lib/api.ts";
import { Mascot } from "./Mascot.tsx";
import { Button } from "./ui/Button.tsx";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <Mascot size={44} still />
      <span className="font-display text-xl font-bold">
        <span className="text-dough">Dough</span>
        <span className="text-matcha-dark">Folio</span>
      </span>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const status = useSetupStatus();
  const passwordRequired = status.phase === "ready" && status.status.passwordRequired;

  async function logout() {
    await apiFetch("/api/session", { method: "DELETE" });
    await status.refresh();
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `wobbly block px-4 py-2.5 font-display font-semibold transition-colors ${
      isActive ? "bg-dough text-ink" : "text-ink-soft hover:bg-cream-dark hover:text-ink"
    }`;

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1" aria-label={t("common.appName")}>
      <NavLink to="/" end className={linkClass} onClick={onNavigate}>
        📊 {t("nav.dashboard")}
      </NavLink>
      <NavLink to="/wallets" className={linkClass} onClick={onNavigate}>
        🧺 {t("nav.wallets")}
      </NavLink>
      <NavLink to="/settings" className={linkClass} onClick={onNavigate}>
        ⚙️ {t("nav.settings")}
      </NavLink>
      {passwordRequired && (
        <div className="mt-auto pt-4">
          <Button variant="ghost" onClick={() => void logout()}>
            {t("common.logout")}
          </Button>
        </div>
      )}
    </nav>
  );
}

/**
 * App frame: fixed left sidebar with the logo on desktop, top bar with a
 * slide-out drawer on mobile (owner request).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-6 border-ink/10 border-r-2 bg-surface/60 p-4 lg:flex">
        <Brand />
        <NavItems />
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="flex items-center justify-between px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-label={t("nav.menu")}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="wobbly border-2 border-ink/20 bg-surface px-3 py-1.5 font-display text-lg"
        >
          ☰
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label={t("common.cancel")}
            className="absolute inset-0 bg-ink/30"
            onClick={() => setOpen(false)}
          />
          <aside className="animate-pop absolute inset-y-0 left-0 flex w-64 flex-col gap-6 bg-surface p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                aria-label={t("common.cancel")}
                onClick={() => setOpen(false)}
                className="px-2 text-xl text-ink-soft"
              >
                ✕
              </button>
            </div>
            <NavItems onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-60">{children}</div>
    </div>
  );
}
