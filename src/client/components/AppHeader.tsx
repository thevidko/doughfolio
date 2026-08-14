import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { useSetupStatus } from "../hooks/useSetupStatus.tsx";
import { apiFetch } from "../lib/api.ts";
import { Mascot } from "./Mascot.tsx";
import { Button } from "./ui/Button.tsx";

/** Shared top bar: brand, navigation, logout (when the instance is protected). */
export function AppHeader() {
  const { t } = useTranslation();
  const status = useSetupStatus();
  const passwordRequired = status.phase === "ready" && status.status.passwordRequired;

  async function logout() {
    await apiFetch("/api/session", { method: "DELETE" });
    await status.refresh();
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `wobbly px-4 py-1.5 font-display font-semibold transition-colors ${
      isActive ? "bg-dough text-ink" : "text-ink-soft hover:text-ink"
    }`;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <div className="flex items-center gap-3">
        <Mascot size={44} still />
        <span className="font-display text-xl font-bold">
          <span className="text-dough">Dough</span>
          <span className="text-matcha-dark">Folio</span>
        </span>
      </div>

      <nav className="flex items-center gap-2" aria-label={t("common.appName")}>
        <NavLink to="/" end className={linkClass}>
          {t("nav.dashboard")}
        </NavLink>
        <NavLink to="/wallets" className={linkClass}>
          {t("nav.wallets")}
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          {t("nav.settings")}
        </NavLink>
      </nav>

      {passwordRequired ? (
        <Button variant="ghost" onClick={() => void logout()}>
          {t("common.logout")}
        </Button>
      ) : (
        <span />
      )}
    </header>
  );
}
