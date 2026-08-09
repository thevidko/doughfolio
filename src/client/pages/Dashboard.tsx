import { useTranslation } from "react-i18next";
import { Mascot } from "../components/Mascot.tsx";
import { ServerStatus } from "../components/ServerStatus.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Card } from "../components/ui/Card.tsx";
import { useSetupStatus } from "../hooks/useSetupStatus.tsx";
import { apiFetch } from "../lib/api.ts";

/** Placeholder dashboard — real portfolio views arrive with the next features. */
export function Dashboard() {
  const { t } = useTranslation();
  const status = useSetupStatus();
  const setup = status.phase === "ready" ? status.status : null;

  async function logout() {
    await apiFetch("/api/session", { method: "DELETE" });
    await status.refresh();
  }

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Mascot size={44} still />
          <span className="font-display text-xl font-bold">
            <span className="text-dough">Dough</span>
            <span className="text-matcha-dark">Folio</span>
          </span>
        </div>
        {setup?.passwordRequired && (
          <Button variant="ghost" onClick={() => void logout()}>
            {t("common.logout")}
          </Button>
        )}
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 p-6 text-center">
        <h1 className="animate-pop text-3xl font-bold">
          {setup?.displayName
            ? t("dashboard.greeting", { name: setup.displayName })
            : t("dashboard.greetingAnonymous")}
        </h1>

        <Card className="animate-pop flex w-full flex-col items-center gap-4 py-10">
          <Mascot size={110} />
          <p className="max-w-md text-ink-soft">{t("dashboard.empty")}</p>
        </Card>

        <ServerStatus />
      </main>
    </div>
  );
}
