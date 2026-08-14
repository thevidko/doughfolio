import { useTranslation } from "react-i18next";
import { AppHeader } from "../components/AppHeader.tsx";
import { HoldingsOverview } from "../components/HoldingsOverview.tsx";
import { ServerStatus } from "../components/ServerStatus.tsx";
import { useSetupStatus } from "../hooks/useSetupStatus.tsx";

/** Placeholder dashboard — real portfolio views arrive with the next features. */
export function Dashboard() {
  const { t } = useTranslation();
  const status = useSetupStatus();
  const setup = status.phase === "ready" ? status.status : null;

  return (
    <div className="min-h-dvh">
      <AppHeader />

      <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 p-6 text-center">
        <h1 className="animate-pop text-3xl font-bold">
          {setup?.displayName
            ? t("dashboard.greeting", { name: setup.displayName })
            : t("dashboard.greetingAnonymous")}
        </h1>

        <HoldingsOverview baseCurrency={setup?.baseCurrency ?? "usd"} />

        <ServerStatus />
      </main>
    </div>
  );
}
